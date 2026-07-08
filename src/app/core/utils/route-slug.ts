export function toRouteSlug(value: string | null | undefined): string {
  return String(value ?? '').trim();
}

export function normalizeRouteSlug(value: string | null | undefined): string {
  const text = String(value ?? '');
  try {
    return decodeURIComponent(text).replace(/[_\s]+/g, ' ').trim();
  } catch {
    return text.replace(/[_\s]+/g, ' ').trim();
  }
}

export function encodeRouteSlug(value: string | null | undefined): string {
  return encodeURIComponent(toRouteSlug(value));
}
