// A video's length and size, read in the browser before anything is uploaded: the price depends on the length. The
// <video> element knows most files. For ones this browser can't play (HEVC .mov files in some browsers), the MP4/MOV
// header is read directly. The render container measures again with ffprobe either way.

export type VideoInfo = { duration: number; width: number | null; height: number | null; playable: boolean };

export async function measureVideo(file: File): Promise<VideoInfo> {
  const played = await viaElement(file).catch(() => null);
  if (played) return { ...played, playable: true };
  const header = await viaMp4Header(file).catch(() => null);
  if (header) return { ...header, playable: false };
  throw new Error("We couldn't read that video. Export it as an MP4, MOV or WebM and try again.");
}

function viaElement(file: File): Promise<Omit<VideoInfo, "playable">> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      video.removeAttribute("src");
      URL.revokeObjectURL(url);
      settle();
    };
    const timer = setTimeout(() => finish(() => reject(new Error("timeout"))), 15_000);
    const found = () => Number.isFinite(video.duration) && video.duration > 0;
    const done = () => finish(() => resolve({ duration: video.duration, width: video.videoWidth || null, height: video.videoHeight || null }));
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onerror = () => finish(() => reject(new Error("unsupported")));
    video.onloadedmetadata = () => {
      if (found()) return done();
      // Screen-recorder WebM files often leave the length out of the header; seeking to the end makes the browser find it.
      video.ondurationchange = () => found() && done();
      video.currentTime = 1e7;
    };
    video.src = url;
  });
}

type Box = { type: string; start: number; end: number };

const fourcc = (view: DataView, at: number) => String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + at, 4));

/** An ISO media box (MP4, MOV) header at `at`: its total size and where its contents start, or null. */
function boxHeader(view: DataView, at: number, rest: number) {
  const size32 = view.getUint32(at);
  const header = size32 === 1 ? 16 : 8;
  const size = size32 === 1 ? Number(view.getBigUint64(at + 8)) : size32 || rest; // 0: runs to the end
  return size < header ? null : { type: fourcc(view, at + 4), size, header };
}

/** The child boxes between `start` and `end`. */
function boxes(view: DataView, start: number, end: number): Box[] {
  const out: Box[] = [];
  for (let at = start; at + 8 <= end;) {
    const box = boxHeader(view, at, end - at);
    if (!box) break;
    out.push({ type: box.type, start: at + box.header, end: Math.min(end, at + box.size) });
    at += box.size;
  }
  return out;
}

/** Length (mvhd) and picture size (the video track's tkhd, turned if the file says so) from an MP4 or MOV header. */
async function viaMp4Header(file: File): Promise<Omit<VideoInfo, "playable">> {
  const read = async (start: number, length: number) => new DataView(await file.slice(start, start + length).arrayBuffer());
  // The moov box can sit anywhere among the top-level boxes (phones often write it last), so hop from header to header.
  for (let at = 0; at + 8 <= file.size;) {
    const box = boxHeader(await read(at, 16), 0, file.size - at);
    if (!box) break;
    if (box.type !== "moov") {
      at += box.size;
      continue;
    }
    const moov = await read(at, Math.min(box.size, 64 << 20));
    let duration = 0;
    let size: { width: number; height: number } | null = null;
    for (const child of boxes(moov, box.header, moov.byteLength)) {
      if (child.type === "mvhd") {
        const v1 = moov.getUint8(child.start) === 1;
        const scale = moov.getUint32(child.start + (v1 ? 20 : 12));
        duration = (v1 ? Number(moov.getBigUint64(child.start + 24)) : moov.getUint32(child.start + 16)) / scale;
      }
      if (child.type !== "trak" || size) continue;
      const tkhd = boxes(moov, child.start, child.end).find((b) => b.type === "tkhd");
      if (!tkhd) continue;
      const matrix = tkhd.start + (moov.getUint8(tkhd.start) === 1 ? 52 : 40);
      const [w, h] = [moov.getUint32(matrix + 36) >>> 16, moov.getUint32(matrix + 40) >>> 16];
      if (!w || !h) continue; // a sound track
      const turned = moov.getInt32(matrix) === 0 && moov.getInt32(matrix + 4) !== 0; // rotated a quarter turn
      size = turned ? { width: h, height: w } : { width: w, height: h };
    }
    if (duration > 0) return { duration, width: size?.width ?? null, height: size?.height ?? null };
    break;
  }
  throw new Error("no movie header");
}
