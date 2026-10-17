import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultData } from "../state/model";
import { GIST_FILE, connect, decide, pull, push, toRemote } from "./gistSync";

const withTime = (t: number) => ({ ...defaultData(), updatedAt: t });

describe("sinkronizacija: zadnja promjena pobjeđuje", () => {
  it("decide", () => {
    expect(decide(withTime(5), null)).toBe("push");
    expect(decide(withTime(5), withTime(9))).toBe("pull");
    expect(decide(withTime(9), withTime(5))).toBe("push");
    expect(decide(withTime(5), withTime(5))).toBe("same");
  });
  it("postavke prikaza ne idu na GitHub", () => {
    const d = withTime(1);
    d.ui.tab = "omlet";
    expect(JSON.parse(toRemote(d)).ui).toBeUndefined();
  });
});

/** Lažni GitHub API s jednim gistom u memoriji */
function fakeGitHub() {
  const gists: Record<string, string> = {};
  let n = 0;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const auth = (init.headers as Record<string, string>)?.Authorization;
    if (auth !== "Bearer dobar") return new Response("{}", { status: 401 });
    const path = url.replace("https://api.github.com", "");
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (path.startsWith("/gists?")) return json(Object.keys(gists).map((id) => ({ id, files: { [GIST_FILE]: {} } })));
    if (path === "/gists" && init.method === "POST") {
      const id = "g" + ++n;
      gists[id] = JSON.parse(init.body as string).files[GIST_FILE].content;
      return json({ id });
    }
    const id = path.split("/")[2];
    if (init.method === "PATCH") {
      gists[id] = JSON.parse(init.body as string).files[GIST_FILE].content;
      return json({});
    }
    return json({ files: { [GIST_FILE]: { content: gists[id] } } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return gists;
}

afterEach(() => vi.unstubAllGlobals());

describe("gist", () => {
  it("prvi uređaj napravi gist, drugi ga pronađe i preuzme podatke", async () => {
    const gists = fakeGitHub();
    const laptop = withTime(100);
    laptop.stock.piletina = { qty: 750, price: 9.99 };
    const a = await connect("dobar", laptop);
    expect(a.remote).toBeNull();
    expect(Object.keys(gists)).toEqual([a.gistId]);

    const b = await connect("dobar", defaultData());
    expect(b.gistId).toBe(a.gistId);
    expect(b.remote!.stock.piletina.qty).toBe(750);

    const phone = { ...b.remote!, updatedAt: 200 };
    phone.stock.piletina = { qty: 500, price: 9.99 };
    await push({ token: "dobar", gistId: a.gistId }, phone);
    const back = await pull({ token: "dobar", gistId: a.gistId });
    expect(back!.stock.piletina.qty).toBe(500);
    expect(decide(laptop, back)).toBe("pull");
  });
  it("neispravan token daje jasnu poruku", async () => {
    fakeGitHub();
    await expect(connect("los", defaultData())).rejects.toThrow(/Token nije ispravan/);
  });
});
