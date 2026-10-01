export function siteBase(): string {
  const base = import.meta.env.BASE_URL;
  return base === '/' ? '' : base.replace(/\/$/, '');
}

export function withBase(path: string): string {
  return `${siteBase()}${path}`;
}
