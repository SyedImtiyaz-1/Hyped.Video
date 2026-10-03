/** A product URL as typed ("myapp.com", "github.com/me/app") made a full https URL, or null when it isn't one. */
export function normalizeSourceUrl(value: string): string | null {
  let url = value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    return new URL(url).hostname.includes(".") ? url : null;
  } catch {
    return null;
  }
}
