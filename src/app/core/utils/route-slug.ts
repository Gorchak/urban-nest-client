export function toRouteSlug(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('uk-UA')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeRouteSlug(value: string | null | undefined): string {
  const text = String(value ?? '');
  try {
    return decodeURIComponent(text).toLocaleLowerCase('uk-UA').replace(/[-_\s]+/g, ' ').trim();
  } catch {
    return text.toLocaleLowerCase('uk-UA').replace(/[-_\s]+/g, ' ').trim();
  }
}

export function encodeRouteSlug(value: string | null | undefined): string {
  return encodeURIComponent(toRouteSlug(value));
}
