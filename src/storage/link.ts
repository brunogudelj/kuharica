/* Link za povezivanje mobitela: adresa aplikacije s tokenom za sinkronizaciju u dijelu iza # (ne šalje se poslužitelju). */
const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function appUrl(): string {
  return location.origin + location.pathname;
}

export function linkUrl(token: string): string {
  return `${appUrl()}#povezi=${b64url(token)}`;
}

export function readLinkToken(v: string): string | null {
  try {
    const t = atob(v.replace(/-/g, "+").replace(/_/g, "/"));
    return /^[A-Za-z0-9_]{20,255}$/.test(t) ? t : null;
  } catch {
    return null;
  }
}
