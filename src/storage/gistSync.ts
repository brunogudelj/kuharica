/* Sinkronizacija preko tajnog GitHub Gista: jedna datoteka kuharica.json koju čitaju i pišu svi uređaji. */
import type { AppData } from "../state/model";
import { fromStored } from "./storage";

export const GIST_FILE = "kuharica.json";
const API = "https://api.github.com";

export interface SyncConfig {
  token: string;
  gistId: string;
}

const CFG_KEY = "kuharica-sync";

/** Postavke sinkronizacije ostaju samo na ovom uređaju */
export function loadSyncConfig(): SyncConfig | null {
  try {
    const v = JSON.parse(localStorage.getItem(CFG_KEY) || "null");
    return v && typeof v.token === "string" && typeof v.gistId === "string" ? v : null;
  } catch {
    return null;
  }
}
export function saveSyncConfig(c: SyncConfig | null) {
  try {
    if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
    else localStorage.removeItem(CFG_KEY);
  } catch {
    /* preglednik ne dopušta spremanje; sinkronizacija radi do zatvaranja */
  }
}

export class SyncError extends Error {
  constructor(
    msg: string,
    readonly status?: number,
  ) {
    super(msg);
  }
}

async function gh(token: string, path: string, init: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new SyncError("Nema veze s GitHubom. Promjene su spremljene na uređaju i poslat će se kad veza proradi.");
  }
  if (res.status === 401)
    throw new SyncError("Token nije ispravan ili je istekao. Napravi novi token i ponovno poveži uređaj.", 401);
  if (res.status === 403 || res.status === 404)
    throw new SyncError("Token nema dozvolu za gistove. Napravi token s dozvolom „gist”.", res.status);
  if (!res.ok) throw new SyncError(`GitHub je vratio grešku ${res.status}. Pokušaj ponovno za minutu.`, res.status);
  return res.json();
}

/** Podaci za sinkronizaciju: sve osim postavki prikaza (one su po uređaju) */
export function toRemote(d: AppData): string {
  const { ui: _ui, ...rest } = d;
  void _ui;
  return JSON.stringify(rest);
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}

async function readFile(token: string, f: GistFile): Promise<AppData> {
  let text = f.content ?? "";
  if (f.truncated && f.raw_url) {
    const r = await fetch(f.raw_url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    text = await r.text();
  }
  return fromStored(JSON.parse(text || "{}"));
}

/** Pronađi postojeći gist s kuharica.json; ako ga nema, napravi novi tajni gist s trenutnim podacima. */
export async function connect(token: string, current: AppData): Promise<{ gistId: string; remote: AppData | null }> {
  for (let page = 1; page <= 5; page++) {
    const list = (await gh(token, `/gists?per_page=100&page=${page}`)) as {
      id: string;
      files: Record<string, unknown>;
    }[];
    const hit = list.find((g) => g.files && g.files[GIST_FILE]);
    if (hit) return { gistId: hit.id, remote: await pull({ token, gistId: hit.id }) };
    if (list.length < 100) break;
  }
  const created = (await gh(token, "/gists", {
    method: "POST",
    body: JSON.stringify({
      description: "Kuharica: zaliha, plan i troškovi (sinkronizacija aplikacije)",
      public: false,
      files: { [GIST_FILE]: { content: toRemote(current) } },
    }),
  })) as { id: string };
  return { gistId: created.id, remote: null };
}

export async function pull(c: SyncConfig): Promise<AppData | null> {
  const g = (await gh(c.token, `/gists/${c.gistId}`)) as { files: Record<string, GistFile> };
  const f = g.files?.[GIST_FILE];
  return f ? readFile(c.token, f) : null;
}

export async function push(c: SyncConfig, d: AppData): Promise<void> {
  await gh(c.token, `/gists/${c.gistId}`, {
    method: "PATCH",
    body: JSON.stringify({ files: { [GIST_FILE]: { content: toRemote(d) } } }),
  });
}

/** Tko je noviji: zadnja promjena pobjeđuje */
export function decide(local: AppData, remote: AppData | null): "pull" | "push" | "same" {
  if (!remote) return "push";
  if (remote.updatedAt > local.updatedAt) return "pull";
  if (local.updatedAt > remote.updatedAt) return "push";
  return "same";
}
