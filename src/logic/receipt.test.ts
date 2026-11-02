import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { fromReceiptText, matchShop } from "./receipt";
import { bulkPurchase } from "./actions";
import { qty } from "./inventory";
import { readLinkToken } from "../storage/link";

describe("račun", () => {
  it("Claudeov odgovor u stavke, nepoznati id se odbacuje", () => {
    const d = defaultData();
    const r = fromReceiptText(
      d,
      'Evo: {"ok":true,"shop":"KAUFLAND HRVATSKA k.d.","date":"2026-11-02","total":12.5,"lines":[' +
        '{"raw":"PIL.PRSA FILE","name":"Pileća prsa","item":"piletina","amount":734,"price":6.6},' +
        '{"raw":"LEDO MEKS.MJES","name":"Ledo meksička mješavina","item":"nepostoji","amount":400,"price":2.49}]}',
    );
    expect(r.date).toBe("2026-11-02");
    expect(r.lines[0]).toMatchObject({ item: "piletina", amount: 734, price: 6.6 });
    expect(r.lines[1].item).toBeNull();
    expect(matchShop(d, r.shop)).toBe("K");
    expect(matchShop(d, "")).toBe("O");
    expect(() => fromReceiptText(d, '{"ok":false,"error":"Nije račun."}')).toThrow("Nije račun.");
  });

  it("sve stavke odjednom u zalihu i troškove, s dućanom s računa", () => {
    const d = defaultData();
    const t = Date.UTC(2026, 10, 2, 12);
    const r = bulkPurchase(
      d,
      [
        { id: "piletina", amount: 734, price: 6.6 },
        { id: "jaja", amount: 10, price: 2.2 },
        { id: "jaja", amount: 0, price: 1 },
      ],
      "BIO",
      t,
    );
    expect(qty(r.data, "piletina")).toBe(734);
    expect(qty(r.data, "jaja")).toBe(10);
    const costs = r.data.costs["2026-11"];
    expect(costs.length).toBe(2);
    expect(costs.every((c) => c.shop === "BIO" && c.t === t)).toBe(true);
    expect(r.msg).toContain("2 stavke dodane");
  });

  it("link za mobitel nosi token", async () => {
    const { linkUrl } = await import("../storage/link");
    globalThis.location = { origin: "https://x.github.io", pathname: "/kuharica/" } as Location;
    const u = linkUrl("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(u.startsWith("https://x.github.io/kuharica/#povezi=")).toBe(true);
    expect(readLinkToken(u.split("#povezi=")[1])).toBe("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
    expect(readLinkToken("!!!")).toBeNull();
  });
});
