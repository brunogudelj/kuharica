# Kuharica: wok i air fryer

Upute za Claude Code. Napravi novi projekt iz ovog dokumenta, pokreni ga lokalno i objavi u novi GitHub repozitorij.

## Kako pokrenuti (za korisnika)

1. Stavi `PROJEKT.md` i mapu `reference/` (s datotekom `kuharica-prototip.html`) u praznu mapu.
2. U toj mapi pokreni `claude`.
3. Napiši: **„Pročitaj PROJEKT.md i napravi sve po njemu.”**

## Zadatak za Claude Code

Pretvori postojeći prototip (`reference/kuharica-prototip.html`, jedna HTML datoteka od oko 1400 redaka) u pravi web projekt. Aplikacija se mora moći instalirati na mobitel (PWA) i raditi offline. Prototip je izvor istine za sve podatke i logiku: recepte, namirnice, prep recepte, omlete, količine, makronutrijente i tekstove. **Podatke prenesi doslovno, ništa ne izmišljaj i ne skraćuj.**

Prije pisanja koda:

1. Pročitaj cijeli prototip.
2. Napravi kratak plan u `docs/PLAN.md` i nastavi bez čekanja. Stani samo kod koraka označenih s **[PITAJ]**.

### Redoslijed rada

1. `git init`, postavi stack (vidi dolje), prvi commit.
2. Izvuci podatke iz prototipa u tipizirane datoteke u `src/data/`.
3. Prenesi logiku izračuna u `src/logic/` kao čiste funkcije, s testovima.
4. Napravi sučelje, karticu po karticu, istim redoslijedom kao u prototipu.
5. Napravi spremanje podataka (local-first), te izvoz i uvoz u JSON.
6. Dodaj PWA (manifest, service worker, ikone).
7. Pokreni `npm run build`, `npm test` i `npm run lint`. Sve mora proći.
8. **[PITAJ]** Prije stvaranja repozitorija pitaj korisnika želi li ga privatnog (zadano) ili javnog i kako da se zove (prijedlog: `kuharica`). Zatim:
   `gh repo create <ime> --private --source=. --remote=origin --push`
   Ako `gh` nije prijavljen, reci korisniku da pokrene `gh auth login` pa nastavi.
9. **[PITAJ]** Ponudi objavu na GitHub Pages (GitHub Actions workflow) ili Vercel. Napravi samo ako korisnik pristane.
10. Na kraju napiši `README.md` (vidi dolje) i završni commit.

Radi male commitove s jasnim porukama na hrvatskom, na primjer `Dodaj karticu Zaliha`.

## Stack

- **Vite + React + TypeScript** (strict)
- Bez UI biblioteka. CSS preuzmi iz prototipa (tokeni na `:root`, svijetla i tamna tema, fontovi Familjen Grotesk, Atkinson Hyperlegible, IBM Plex Mono).
- **Vitest** za testove logike
- **ESLint + Prettier**
- **vite-plugin-pwa** za PWA
- Spremanje: **IndexedDB** preko malog wrappera (npr. `idb-keyval`), iza sučelja `Storage` (vidi dolje)
- Node 20+

Struktura:

```
src/
  data/        katalog namirnica, recepti, prep, omlet, makronutrijenti
  logic/       izračuni (čiste funkcije) + *.test.ts
  storage/     Storage sučelje, IndexedDB implementacija, izvoz/uvoz
  state/       stanje aplikacije (React context + reducer)
  components/  zajednički dijelovi (Stepper, Pill, Toast, Tabs...)
  tabs/        Plan, Omlet, Zaliha, Kupovina, Troskovi, Recepti, Prep
  styles/      tokens.css, app.css
docs/PLAN.md
reference/kuharica-prototip.html
```

## Što aplikacija radi

Korisnik kuha jednom dnevno (do 30 min, wok i air fryer). Jedno kuhanje od 1,5 porcija daje ručak i večeru. Uz oba obroka ide velika salata, uz jedan miso juha, a posni sir je užina. Doručak je omlet, svaki dan drugi (7 različitih kombinacija tjedno). Cilj je mršavljenje.

Ugljikohidrati se izmjenjuju u ciklusu od 5 dana: **riža → krumpir → tjestenina → riža → krumpir**. Kupuje u Zagrebu: Kaufland, Bio&Bio i azijski dućani.

### Kartice (istim redoslijedom kao u prototipu)

1. **Plan:** tjedan od ponedjeljka do nedjelje. Svaki dan ima oznaku dana ciklusa i odabir recepta, uz napomenu „sve imaš” ili „fali: …”. Gumbi su _Popuni tjedan_ (odabire recepte prema ciklusu, ravnomjerno, prednost imaju oni za koje ima sastojaka), _Novi tjedan_ (pomiče ciklus za 7 dana i slaže nove omlete) i _Skuhano_ po danu. Ispod je povijest kuhanja.
2. **Omlet:** tjedni plan od 7 omleta (svaki dan drugi) s gumbom _Novi omleti za tjedan_, koji ne ponavlja kombinacije i daje prednost onima za koje ima sastojaka. Dodir na dan otvara uređivanje tog dana. Tu je 15 gotovih kombinacija, _Iznenadi me_ (nasumično 1 protein i 2 povrća, prednost onome što je na zalihi) i slaganje vlastitog omleta (baza, protein, povrće, prilog). Svaki omlet ima makronutrijente, cijenu, brojač porcija, korake za wok ili air fryer koji se slažu prema nadjevu, _Pojeo sam_ i _Označi kao nepojeden_. Ako na zalihi ima barem 4 egg muffina, nudi ih kao zamjenu.
3. **Zaliha:** blok _Pripremljeno_ (vrećice i kutije iz prepa), sažetak (na zalihi, nisko, nema), filtri, a za svaku namirnicu stepper, oznaka stanja, dućan, točan unos količine i cijena po pakiranju.
4. **Kupovina:** popis koji se računa sam, grupiran po dućanu, s pakiranjima i cijenom. Gumb _Kupio_ povećava zalihu i bilježi trošak. Tu su i kopiranje popisa te linkovi na dućane (preuzmi iz prototipa).
5. **Troškovi:** pločice (potrošeno ovaj mjesec, procjena za mjesec, prosječan obrok, ušteda u odnosu na dostavu), unos računa, potrošnja po dućanu, cijena po obroku za svaki recept, postavke usporedbe i zapisi po mjesecima.
6. **Recepti:** 12 recepata s filterima (Sve, Mogu skuhati, Riža, Krumpir, Tjestenina, 2 u 1), brojač porcija od 1 naviše, informacija što fali i što se koristi iz prepa te gumb _Skuhao sam_.
7. **Prep:** nedjeljni redoslijed minutu po minutu i 18 prep recepata s filterima. Svaki ima količinu, vrijeme, čuvanje, množitelj, stanje na zalihi, sastojke, korake, savjet, „koristi u” i gumb _Napravio sam_.

Sve radnje koje mijenjaju podatke imaju toast s gumbom **Poništi** (6 s).

## Pravila izračuna (obavezno testirati)

Prenesi točno ponašanje iz prototipa. Funkcije u prototipu: `effUse`, `planNeeds`, `shopping`, `status`, `missingFor`, `costOf`, `dayCost`, `omUse`, `omEff`, `omMacros`, `scaleText`, `niceNum`, `plural`, `cook`, `makePrep`, `eatOmlet`.

1. **Osnovna količina recepta je 1,5 porcija.** Brojač na receptu kreće od 1, pa je faktor `porcije / 1,5`. Tjedni plan uvijek računa faktor 1 (dakle 1,5 porcija).
2. **Dnevni dodaci** (`DAILY`: miso, wakame, tofu, posni sir, salata, krastavci, rajčice, ulje) troše se jednom po skuhanom danu i ne skaliraju se s porcijama.
3. **Pripremljeno je zaseban inventar.** _Napravio sam_ skida sirove sastojke × množitelj i dodaje `make × množitelj` jedinica. Recept (`REC_USE_PREP`) i dnevni dodaci (`DAILY_PREP`) prvo troše pripremljeno. Sirovi sastojci umanjuju se za `PREP_INV.per × iskorištene jedinice`. **Ništa se ne smije oduzeti dvaput.**
4. **Kupovina:** potreba = zbroj stvarne potrošnje za neskuhane planirane dane (uz dnevne dodatke i prep) + svi nepojedeni omleti iz tjednog plana omleta + minimum zalihe. Od toga se oduzme trenutna zaliha i zaokruži na cijela pakiranja.
5. **Stanje namirnice:** „nema” (0, a minimum je veći od 0), „nisko” (ispod minimuma), „ok”.
6. **Cijena** = cijena pakiranja / veličina pakiranja × količina. Cijena po obroku = (recept + dnevni dodaci) / 2. Dan = recept + dodaci + prosječna cijena omleta iz tjednog plana.
7. **Procjena za mjesec:** po tempu potrošnje (`potrošeno / dan u mjesecu × dana u mjesecu`) kad je prošlo barem 7 dana i postoji potrošnja. Inače iz plana (prosječan dan × dana u mjesecu).
8. **Račun** zamjenjuje automatske procjene (`est: true`) za isti dućan i isti dan.
9. **Skaliranje teksta** (`scaleText`): skaliraju se brojevi u sastojcima, ali ne brojevi iza „po ” niti brojevi s jedinicama `%`, `°C`, `min`, `cm`, `mm`. Za g i ml iznad 20 zaokružuje se na 5, a za komade se koriste razlomci (½, ⅓, ¼, ⅔, ¾).
10. **Hrvatska množina** (`plural`): 1 vrećica, 2–4 vrećice, 5+ vrećica (s iznimkama 11–14).

Testovi moraju pokriti barem pravila 1–4, 8 i 9 te scenarij: „2 vrećice tandoorija + 1 kutija krumpira → skuhaj tandoori → piletina i krumpir se ne skidaju sa sirove zalihe, vrećica i kutija se skidaju”.

## Spremanje podataka

Local-first. Sučelje, da se kasnije može dodati sinkronizacija:

```ts
interface Storage {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>; // debounce 400–600 ms
}
type AppData = {
  version: 1;
  stock: Record<string, { qty: number; price: number | null }>;
  prepStock: Record<string, number>;
  plan: {
    start: number;
    days: { r: string; done: boolean }[];
    om: { sel: { base: string; fill: string[]; carb: string }; done: boolean }[];
  };
  hist: { r: string; t: number }[];
  costs: Record<string, { id: string; t: number; shop: string; amount: number; note: string; est: boolean }[]>; // ključ "YYYY-MM"
  settings: { dostava: number };
  ui: { servings: Record<string, number>; ture: Record<string, number>; tab: string };
};
```

- Zadane vrijednosti: dostava 12 € po obroku, a tjedni plan omleta čini prvih 7 gotovih kombinacija.
- U Postavkama (na dnu kartice Troškovi) dodaj **Izvezi podatke** (preuzimanje JSON datoteke) i **Uvezi podatke** (učitavanje JSON-a s potvrdom unutar stranice, ne `confirm()`).
- Ako se `version` promijeni, napiši migraciju.

**[PITAJ] Sinkronizacija između uređaja** (opcionalno, faza 2): ponudi Supabase (besplatni plan) kao drugu implementaciju sučelja `Storage`. Ključeve drži u `.env.local` i nemoj ih commitati. Napravi samo ako korisnik pristane.

## Cijene iz trgovina (opcionalno, faza 2)

Postoji otvoreni API s cijenama hrvatskih trgovačkih lanaca, uključujući Kaufland: **https://cijene.dev** (kod: https://github.com/senko/cijene-api). Treba mu besplatni API ključ.

**[PITAJ]** Pitaj korisnika ima li ključ. Ako ima:

- Prvo pročitaj dokumentaciju na `https://cijene.dev/docs`. Endpointe nemoj pogađati.
- Napravi skriptu `scripts/cijene.ts` koja za namirnice iz kataloga traži proizvode u Kauflandu i predlaže cijenu pakiranja. Korisnik predložene cijene potvrđuje u aplikaciji, a ne upisuju se automatski.
- Ključ ide u `.env.local` kao `CIJENE_API_KEY`. Dodaj `.env.example`.

Bio&Bio i azijski dućani nisu u tom API-ju, za njih se cijene i dalje upisuju ručno.

## Kvaliteta

- Mobitel je glavni uređaj: sve mora raditi na širini od 360 px, bez vodoravnog skrolanja, s minimalno 16 px ruba.
- Podržane su svijetla i tamna tema (`prefers-color-scheme`).
- Pristupačnost: ARIA za kartice, vidljiv fokus, `aria-label` na stepperima i podrška za `prefers-reduced-motion`.
- Brojevi su u hrvatskom formatu (`1,5`, `12,30 €`), a datumi preko `hr-HR`.
- Sav tekst u sučelju je na hrvatskom, preuzet iz prototipa.
- Bez `alert`, `confirm` i `prompt`, sve potvrde su unutar stranice.

## README.md

Napiši na hrvatskom:

- što aplikacija radi (kratko)
- kako je pokrenuti: `npm install`, `npm run dev`
- kako je instalirati na mobitel (otvori u pregledniku → _Dodaj na početni zaslon_)
- kako se vodi inventar: prvi popis, što se bilježi samo, što ručno, tjedna provjera
- kako dodati novi recept (koje datoteke u `src/data/` i koja polja)
- kako napraviti backup (izvoz JSON-a)

## Gotovo je kad

- [ ] `npm run dev` pokreće aplikaciju i sve kartice rade kao u prototipu
- [ ] `npm test` prolazi i pokriva pravila izračuna
- [ ] `npm run build` prolazi bez grešaka i upozorenja TypeScripta
- [ ] aplikacija se instalira kao PWA i radi offline
- [ ] podaci ostaju nakon osvježavanja, a izvoz i uvoz rade
- [ ] repozitorij je na GitHubu (nakon potvrde korisnika)
- [ ] README je napisan
