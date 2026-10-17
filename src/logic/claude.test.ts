import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { ClaudeError, fromClaudeText } from "./claude";
import { toDraft } from "./importRecipe";

describe("Claude uvoz", () => {
  const d = defaultData();
  it("JSON odgovor postaje nacrt recepta s namirnicama iz zalihe", () => {
    const txt = `Evo recepta:\n{"ok": true, "n": "Piletina u woku", "servings": 2, "minutes": 20, "method": "Wok", "carb": "Riža",
      "ingredients": [{"raw": "400 g chicken breast", "item": "piletina", "amount": 400}, {"raw": "salt", "item": null, "amount": null},
      {"raw": "1 cup rice", "item": "basmati", "amount": 190}], "steps": ["Skuhaj rižu.", "Zapeci piletinu."], "kcal": 520, "protein": 45}`;
    const r = fromClaudeText(d, txt, "https://x.com/r");
    const { draft, matched } = toDraft(d, r.parsed, r);
    expect(draft.n).toBe("Piletina u woku");
    expect(draft.d).toBe("Wok · 20 min");
    expect(draft.c).toBe("Riža");
    expect(draft.use.piletina).toBe(300);
    expect(draft.use.basmati).toBe(142.5);
    expect(matched).toBe(2);
    expect(draft.extra[0]).toBe("salt");
    expect(draft.st).toHaveLength(2);
  });
  it("greška s hrvatskom porukom", () => {
    expect(() => fromClaudeText(d, '{"ok": false, "error": "Stranica traži prijavu."}', "")).toThrow(ClaudeError);
    expect(() => fromClaudeText(d, "nešto bez jsona", "")).toThrow(/očekivanom obliku/);
  });
});
