export function ensureLeadingSlash(pathname: string) {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

