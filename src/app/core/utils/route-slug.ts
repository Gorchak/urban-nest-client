export function toRouteSlug(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

export function normalizeRouteSlug(value: string | null | undefined): string {
  const text = String(value ?? '');
  try {
    return decodeURIComponent(text).trim();
  } catch {
    return text.trim();
  }
}

export function encodeRouteSlug(value: string | null | undefined): string {
  return encodeURIComponent(toRouteSlug(value));
}
