#!/usr/bin/env python3
"""Person masks for the "Behind you" caption style (runner/src/reel.ts).

Reads a video and writes a grayscale mask video of the same length and frame rate: white where the person is, black
elsewhere. Model: MediaPipe's selfie multiclass segmenter (Apache-2.0) on LiteRT, CPU only. The person is everything
the model doesn't call background, so hair and clothes count.

    segment.py <video> <mask.mkv> <model.tflite>

Prints one JSON line when done: {"frames": n, "coverage": share of frames with a person, "seconds": time taken}.
"""
import json
import subprocess
import sys
import time

import numpy as np
from ai_edge_litert.interpreter import Interpreter

SIZE = 256  # the model's input
SMOOTH = 0.7  # weight of the new frame against the last mask: steadier edges with almost no lag
EDGE = (0.3, 0.7)  # confidence ramp: below is background, above is person, smooth in between


def probe(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", path]
    )
    s = json.loads(out)["streams"][0]
    return s["width"], s["height"], s["r_frame_rate"]


def main(src, dst, model):
    started = time.time()
    width, height, fps = probe(src)
    # Letterbox into the model's square so the person keeps their proportions.
    if height >= width:
        sh, sw = SIZE, max(2, round(width * SIZE / height / 2) * 2)
    else:
        sw, sh = SIZE, max(2, round(height * SIZE / width / 2) * 2)
    px, py = (SIZE - sw) // 2, (SIZE - sh) // 2
    # The mask is stored at half the video's size; the composite scales it back up.
    mw, mh = width // 4 * 2, height // 4 * 2

    decode = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={sw}:{sh}:flags=area,pad={SIZE}:{SIZE}:{px}:{py}:black", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    encode = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{sw}x{sh}", "-r", fps, "-i", "-",
         "-vf", f"scale={mw}:{mh}:flags=bicubic", "-c:v", "ffv1", "-pix_fmt", "gray", dst],
        stdin=subprocess.PIPE,
    )

    interpreter = Interpreter(model_path=model, num_threads=4)
    interpreter.allocate_tensors()
    tensor_in = interpreter.get_input_details()[0]["index"]
    tensor_out = interpreter.get_output_details()[0]["index"]
    lo, hi = EDGE
    previous = None
    frames = with_person = 0
    frame_bytes = SIZE * SIZE * 3
    while True:
        raw = decode.stdout.read(frame_bytes)
        if len(raw) < frame_bytes:
            break
        image = np.frombuffer(raw, np.uint8).reshape(1, SIZE, SIZE, 3).astype(np.float32) / 255.0
        interpreter.set_tensor(tensor_in, image)
        interpreter.invoke()
        scores = interpreter.get_tensor(tensor_out)[0][py : py + sh, px : px + sw]
        # Softmax over the six classes (the raw output may be logits), then person = not background.
        scores = np.exp(scores - scores.max(axis=-1, keepdims=True))
        person = 1.0 - scores[..., 0] / scores.sum(axis=-1)
        if previous is not None:
            person = SMOOTH * person + (1 - SMOOTH) * previous
        previous = person
        mask = np.clip((person - lo) / (hi - lo), 0.0, 1.0)
        mask = mask * mask * (3 - 2 * mask)  # smoothstep: crisp edges without stair-steps
        frames += 1
        with_person += int(mask.mean() > 0.04)
        encode.stdin.write((mask * 255).astype(np.uint8).tobytes())
    encode.stdin.close()
    decode.wait()
    if encode.wait() != 0:
        sys.exit("mask encoding failed")
    print(json.dumps({"frames": frames, "coverage": round(with_person / max(frames, 1), 3), "seconds": round(time.time() - started, 1)}))


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:4])
