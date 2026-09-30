// Sends a video to R2 through /api/reels/uploads in parts: 3 at a time, each tried up to 3 times, with progress.
// XMLHttpRequest rather than fetch, because only XHR reports upload progress.

export type Uploaded = { key: string; bytes: number };
export type UploadJob = { done: Promise<Uploaded>; cancel: () => void };

class UploadError extends Error {}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new UploadError(data.error ?? `Upload failed (${res.status})`);
  return data;
}

export function uploadVideo(file: File, contentType: string, onProgress: (sent: number) => void): UploadJob {
  const requests = new Set<XMLHttpRequest>();
  let cancelled = false;
  let started: { key: string; uploadId: string } | null = null;

  const sendPart = (url: string, body: Blob, onSent: (bytes: number) => void) =>
    new Promise<{ partNumber: number; etag: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      requests.add(xhr);
      xhr.open("PUT", url);
      xhr.setRequestHeader("content-type", "application/octet-stream");
      xhr.upload.onprogress = (e) => onSent(e.loaded);
      xhr.onload = () => {
        requests.delete(xhr);
        const data = (() => {
          try {
            return JSON.parse(xhr.responseText);
          } catch {
            return {};
          }
        })();
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(xhr.status >= 400 && xhr.status < 500 ? new UploadError(data.error ?? `Upload failed (${xhr.status})`) : new Error(`HTTP ${xhr.status}`));
      };
      xhr.onerror = xhr.onabort = () => {
        requests.delete(xhr);
        reject(new Error("network"));
      };
      xhr.send(body);
    });

  const done = (async () => {
    const { key, uploadId, partBytes } = await json<{ key: string; uploadId: string; partBytes: number }>(
      await fetch("/api/reels/uploads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentType, bytes: file.size }) }),
    );
    started = { key, uploadId };
    const count = Math.ceil(file.size / partBytes);
    const sent = new Array<number>(count).fill(0);
    const report = () => onProgress(sent.reduce((a, b) => a + b, 0));
    const parts: { partNumber: number; etag: string }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < count && !cancelled) {
        const n = next++;
        const body = file.slice(n * partBytes, Math.min(file.size, (n + 1) * partBytes));
        const url = `/api/reels/uploads/part?${new URLSearchParams({ key, uploadId, part: String(n + 1) })}`;
        for (let attempt = 1; ; attempt++) {
          try {
            parts.push(await sendPart(url, body, (bytes) => ((sent[n] = bytes), report())));
            break;
          } catch (err) {
            // Refusals (4xx) won't change on a retry; dropped connections and server errors might.
            if (cancelled || err instanceof UploadError || attempt >= 3) throw err;
            sent[n] = 0;
            await new Promise((r) => setTimeout(r, attempt * 1500));
          }
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (cancelled) throw new Error("cancelled");
    return json<Uploaded>(await fetch("/api/reels/uploads/complete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key, uploadId, parts }) }));
  })().catch((err: unknown) => {
    // Leave nothing half-uploaded behind.
    if (started) void fetch("/api/reels/uploads", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(started) }).catch(() => {});
    if (cancelled) throw new DOMException("Upload cancelled", "AbortError");
    throw err instanceof UploadError ? err : new Error("The upload was interrupted. Check your connection and try again.");
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      for (const xhr of requests) xhr.abort();
    },
  };
}
