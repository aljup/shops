export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function slugOrFallback(input: string, fallbackPrefix: string): string {
  const slug = slugify(input);
  return slug.length > 0 ? slug : `${fallbackPrefix}-${Date.now().toString(36)}`;
}
