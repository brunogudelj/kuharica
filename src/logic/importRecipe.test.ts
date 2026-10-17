import { describe, expect, it } from "vitest";
import { defaultData } from "../state/model";
import { isoMinutes, matchItem, parseIngredient, parseRecipeHtml, parseRecipeText, toDraft } from "./importRecipe";

const HTML = `<html><head><title>x</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":["Recipe"],
"name":"Piletina s brokulom i rižom","recipeYield":"2 porcije","totalTime":"PT25M",
"recipeIngredient":["400 g pilećih prsa","150 g basmati riže","1 brokula (oko 400 g)","2 žlice soja umaka","1 žličica meda","2 režnja češnjaka","prstohvat soli"],
"recipeInstructions":[{"@type":"HowToStep","text":"Skuhaj rižu."},{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Zapeci piletinu u woku."}]}],
"nutrition":{"calories":"520 kcal","proteinContent":"45 g"}}]}</script></head><body></body></html>`;

describe("recept iz linka", () => {
  const d = defaultData();

  it("čita schema.org Recipe iz JSON-LD (i iz @graph)", () => {
    const p = parseRecipeHtml(HTML, "https://primjer.hr/r")!;
    expect(p.n).toBe("Piletina s brokulom i rižom");
    expect(p.ingredients).toHaveLength(7);
    expect(p.steps).toEqual(["Skuhaj rižu.", "Zapeci piletinu u woku."]);
    expect(p.minutes).toBe(25);
    expect(p.servings).toBe(2);
    expect(p.kcal).toBe(520);
  });

  it("prepoznaje količine, jedinice i namirnice", () => {
    const a = parseIngredient(d, "400 g pilećih prsa");
    expect(a.item?.id).toBe("piletina");
    expect(a.amount).toBe(400);
    const b = parseIngredient(d, "2 žlice soja umaka");
    expect(b.item?.id).toBe("soja");
    expect(b.amount).toBe(30);
    const c = parseIngredient(d, "2 režnja češnjaka");
    expect(c.item?.id).toBe("cesnjak");
    expect(c.amount).toBe(2);
    expect(parseIngredient(d, "1 kg krumpira").amount).toBe(1000);
    expect(parseIngredient(d, "½ l mlijeka").amount).toBe(500);
    expect(parseIngredient(d, "1 1/2 žlice maslinovog ulja").amount).toBe(22.5);
    expect(parseIngredient(d, "1 1/2 tbsp olive oil").amount).toBe(22.5);
    expect(parseIngredient(d, "1½ šalica mlijeka").amount).toBe(360);
    expect(matchItem(d, "chicken breast")?.id).toBe("piletina");
    expect(matchItem(d, "rice vinegar")?.id).toBe("rizin-ocat");
  });

  it("radi nacrt recepta za 1,5 porcije, neprepoznato ide u ostalo", () => {
    const { draft, matched } = toDraft(d, parseRecipeHtml(HTML, "https://primjer.hr/r")!);
    expect(draft.c).toBe("Riža");
    expect(draft.d).toBe("Wok · 25 min");
    // 400 g za 2 porcije → 300 g za 1,5 porcije
    expect(draft.use.piletina).toBe(300);
    expect(matched).toBeGreaterThanOrEqual(5);
    expect(draft.extra.some((x) => x.includes("soli"))).toBe(true);
    expect(draft.extra.at(-1)).toContain("primjer.hr");
  });

  it("zalijepljeni tekst i ISO vrijeme", () => {
    const p = parseRecipeText(
      "Tuna salata\n2 porcije, 10 min\n- 1 konzerva tune\n- 200 g rajčica\nSve nareži i pomiješaj u zdjeli, začini limunom.",
    );
    expect(p.n).toBe("Tuna salata");
    expect(p.ingredients).toHaveLength(2);
    expect(p.steps).toHaveLength(1);
    expect(p.servings).toBe(2);
    expect(isoMinutes("PT1H20M")).toBe(80);
  });
});
