// A clip handed from one page to the next in this tab (the prompt box to the editor on a clip from this computer):
// kept in memory, which a navigation inside the app keeps, so even a big file opens at once without being copied. A
// reload loses it, and the editor asks for the clip again.
let handed: File | null = null;

export const handClip = (file: File) => void (handed = file);

export function takeClip(): File | null {
  const file = handed;
  handed = null;
  return file;
}
