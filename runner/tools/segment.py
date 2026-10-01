#!/usr/bin/env python3
"""Person masks for the "Behind you" caption style (runner/src/reel.ts).

Reads a video and writes, for every frame:
- a grayscale mask video at half the video's size: white where the person is, black elsewhere;
- a grid file: per frame, three layers of GRID x GRID cells, one byte each (0-255): the share of each cell the person
  covers, the share that's their face, and how bright the cell is. reel.ts places each big word with it, so the
  speaker hides just the right part of the word, a word that has to go in front stays off the face, and a word on a
  bright wall gets a stronger shadow.

Model: MediaPipe's selfie multiclass segmenter (Apache-2.0) on LiteRT, CPU only. The person is everything the model
doesn't call background, so hair and clothes count; the face is its face-skin class. Two passes:
1. inference on every frame, and hard cuts found from how much consecutive frames differ;
2. zero-phase smoothing (forward, then backward) within each shot, so the mask is steady without lagging behind and
   never bleeds across a cut; then a fast guided filter against the real frame, so edges follow the hair and the
   shoulders instead of the model's 256-pixel blocks.

    segment.py <video> <mask.mkv> <model.tflite> <grid.bin>

Prints one JSON line when done: frames, coverage (share of frames with a person), cuts (frame numbers where a new
shot starts), grid size and the time taken.
"""
import json
import os
import subprocess
import sys
import time

# The matrix products here are small: extra BLAS threads would only fight the model's own threads for the CPU.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")

import numpy as np  # noqa: E402 (after the thread settings, which numpy reads when it loads)
from ai_edge_litert.interpreter import Interpreter  # noqa: E402

SIZE = 256  # the model's input
GRID = 48  # placement grid: GRID x GRID cells over the frame, fine enough to tell how much of each letter is hidden
FACE = 3  # the model's classes: background, hair, body skin, face skin, clothes, other
SMOOTH = 0.55  # weight of each new frame in the forward and the backward pass
EDGE = (0.25, 0.75)  # after refinement: below is background, above is person, smooth in between
CUT = 0.1  # mean change between consecutive thumbnails (0-1) that marks a hard cut...
CUT_RATIO = 4.0  # ...when it's also this many times the recent typical change
RADIUS, EPS = 2, 4e-4  # guided filter, at the model's resolution


def probe(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", path]
    )
    s = json.loads(out)["streams"][0]
    return s["width"], s["height"], s["r_frame_rate"]


def interp_matrix(n_out, n_in):
    """Bilinear resampling weights, n_out x n_in, pixel centres aligned."""
    x = (np.arange(n_out) + 0.5) * n_in / n_out - 0.5
    x0 = np.clip(np.floor(x).astype(np.int64), 0, n_in - 1)
    x1 = np.clip(x0 + 1, 0, n_in - 1)
    w1 = np.clip(x - np.floor(x), 0.0, 1.0).astype(np.float32)
    m = np.zeros((n_out, n_in), np.float32)
    rows = np.arange(n_out)
    np.add.at(m, (rows, x0), 1 - w1)
    np.add.at(m, (rows, x1), w1)
    return m


def box(a, r):
    """Mean over a (2r+1) x (2r+1) window; at the edges, over the part of the window inside the image."""
    h, w = a.shape
    c = np.zeros((h + 1, w + 1), np.float32)
    c[1:, 1:] = np.cumsum(np.cumsum(a, 0), 1)
    y0, y1 = np.clip(np.arange(h) - r, 0, h), np.clip(np.arange(h) + r + 1, 0, h)
    x0, x1 = np.clip(np.arange(w) - r, 0, w), np.clip(np.arange(w) + r + 1, 0, w)
    s = c[y1][:, x1] - c[y0][:, x1] - c[y1][:, x0] + c[y0][:, x0]
    return s / ((y1 - y0)[:, None] * (x1 - x0)[None, :])


def main(src, dst, model, grid_path):
    started = time.time()
    width, height, fps = probe(src)
    # Letterbox into the model's square so the person keeps their proportions.
    if height >= width:
        sh, sw = SIZE, max(2, round(width * SIZE / height / 2) * 2)
    else:
        sw, sh = SIZE, max(2, round(height * SIZE / width / 2) * 2)
    px, py = (SIZE - sw) // 2, (SIZE - sh) // 2
    # The mask is written at half the video's size; the composite scales it back up once, bilinear.
    mw, mh = width // 4 * 2, height // 4 * 2

    # Pass 1: the model on every frame, plus the cuts.
    interpreter = Interpreter(model_path=model, num_threads=4)
    interpreter.allocate_tensors()
    tensor_in = interpreter.get_input_details()[0]["index"]
    tensor_out = interpreter.get_output_details()[0]["index"]
    decode = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={sw}:{sh}:flags=area,pad={SIZE}:{SIZE}:{px}:{py}:black", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    probs, guides, faces, cuts, diffs = [], [], [], [0], []
    model_rows = np.linspace(0, sh, GRID + 1).astype(np.int64)[:-1]
    model_cols = np.linspace(0, sw, GRID + 1).astype(np.int64)[:-1]
    model_cells = np.diff(np.append(model_rows, sh))[:, None] * np.diff(np.append(model_cols, sw))[None, :]
    previous_thumb = None
    frame_bytes = SIZE * SIZE * 3
    while True:
        raw = decode.stdout.read(frame_bytes)
        if len(raw) < frame_bytes:
            break
        image = np.frombuffer(raw, np.uint8).reshape(SIZE, SIZE, 3)
        interpreter.set_tensor(tensor_in, (image.astype(np.float32) / 255.0)[None])
        interpreter.invoke()
        scores = interpreter.get_tensor(tensor_out)[0][py : py + sh, px : px + sw]
        scores = np.exp(scores - scores.max(axis=-1, keepdims=True))
        total = scores.sum(axis=-1)
        probs.append(((1.0 - scores[..., 0] / total) * 255).astype(np.uint8))
        face = np.add.reduceat(np.add.reduceat(scores[..., FACE] / total, model_rows, axis=0), model_cols, axis=1)
        faces.append(np.clip(face / model_cells * 255, 0, 255).astype(np.uint8))
        gray = image[py : py + sh, px : px + sw].astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
        guides.append(gray.astype(np.uint8))
        thumb = gray[: sh // 8 * 8, : sw // 8 * 8].reshape(sh // 8, 8, sw // 8, 8).mean(axis=(1, 3)) / 255.0
        if previous_thumb is not None:
            change = float(np.abs(thumb - previous_thumb).mean())
            typical = float(np.median(diffs[-15:])) if diffs else change
            if change > CUT and change > CUT_RATIO * max(typical, 0.004):
                cuts.append(len(probs) - 1)
            diffs.append(change)
        previous_thumb = thumb
    decode.wait()
    frames = len(probs)
    if frames == 0:
        sys.exit("no frames decoded")

    # Pass 2, part 1: zero-phase smoothing within each shot.
    bounds = cuts + [frames]
    smooth = np.empty((frames, sh, sw), np.float32)
    for a, b in zip(bounds[:-1], bounds[1:]):
        state = probs[a].astype(np.float32)
        for i in range(a, b):
            state = SMOOTH * probs[i] + (1 - SMOOTH) * state
            smooth[i] = state
        state = smooth[b - 1].copy()
        for i in range(b - 1, a - 1, -1):
            state = SMOOTH * smooth[i] + (1 - SMOOTH) * state
            smooth[i] = state
    smooth /= 255.0

    # Pass 2, part 2: a fast guided filter. Its coefficients come from the model-resolution frame and mask; they are
    # resampled to half the video's size and applied to the half-size frame, so the mask's edges follow real edges.
    up_y, up_x = interp_matrix(mh, sh), interp_matrix(mw, sw).T
    guide_decode = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={mw}:{mh}:flags=area", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        stdout=subprocess.PIPE,
    )
    encode = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{mw}x{mh}", "-r", fps, "-i", "-", "-c:v", "ffv1", "-pix_fmt", "gray", dst],
        stdin=subprocess.PIPE,
    )
    cols = np.linspace(0, mw, GRID + 1).astype(np.int64)[:-1]
    rows = np.linspace(0, mh, GRID + 1).astype(np.int64)[:-1]
    lo, hi = EDGE
    grid = np.empty((frames, 3, GRID, GRID), np.uint8)
    with_person = 0
    guide_bytes = mw * mh
    for i in range(frames):
        raw = guide_decode.stdout.read(guide_bytes)
        if len(raw) < guide_bytes:
            raw = raw + bytes(guide_bytes - len(raw))  # a short last frame: pad rather than fail
        guide = np.frombuffer(raw, np.uint8).reshape(mh, mw).astype(np.float32) / 255.0
        small_i = guides[i].astype(np.float32) / 255.0
        p = smooth[i]
        mean_i, mean_p = box(small_i, RADIUS), box(p, RADIUS)
        var = box(small_i * small_i, RADIUS) - mean_i * mean_i
        cov = box(small_i * p, RADIUS) - mean_i * mean_p
        a = cov / (var + EPS)
        b = mean_p - a * mean_i
        a, b = box(a, RADIUS), box(b, RADIUS)
        refined = (up_y @ a @ up_x) * guide + (up_y @ b @ up_x)
        mask = np.clip((refined - lo) / (hi - lo), 0.0, 1.0)
        mask = mask * mask * (3 - 2 * mask)  # smoothstep
        alpha = (mask * 255).astype(np.uint8)
        encode.stdin.write(alpha.tobytes())
        cells = np.add.reduceat(np.add.reduceat(mask, rows, axis=0), cols, axis=1)
        sizes = np.diff(np.append(rows, mh))[:, None] * np.diff(np.append(cols, mw))[None, :]
        grid[i, 0] = np.clip(cells / sizes * 255, 0, 255).astype(np.uint8)
        grid[i, 1] = faces[i]
        grid[i, 2] = np.clip(np.add.reduceat(np.add.reduceat(guide, rows, axis=0), cols, axis=1) / sizes * 255, 0, 255).astype(np.uint8)
        with_person += int(mask.mean() > 0.04)
    encode.stdin.close()
    guide_decode.wait()
    if encode.wait() != 0:
        sys.exit("mask encoding failed")
    grid.tofile(grid_path)
    print(json.dumps({
        "frames": frames,
        "coverage": round(with_person / frames, 3),
        "cuts": cuts[1:],
        "grid": GRID,
        "seconds": round(time.time() - started, 1),
    }))


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:5])
