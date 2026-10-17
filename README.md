# Wok i Air Fryer Kuharica

Osobna aplikacija za kuhanje i mršavljenje. Jedno kuhanje dnevno (do 30 min, wok i air fryer) daje ručak i večeru, a doručak je omlet, svaki dan drugi. Aplikacija vodi zalihu namirnica, sama slaže popis za kupovinu, prati troškove i uspoređuje ih s dostavom.

- **Plan:** tjedan prema ciklusu ugljikohidrata riža → krumpir → tjestenina → riža → krumpir
- **Omlet:** 7 različitih omleta tjedno, 15 gotovih kombinacija, _Iznenadi me_ i slaganje vlastitog
- **Zaliha:** količine u g, ml i komadima, cijene pakiranja i pripremljeno iz prepa
- **Kupovina:** popis koji se računa sam, po dućanima (Kaufland, Bio&Bio, azijski dućani)
- **Troškovi:** računi, procjena za mjesec, cijena po obroku i ušteda prema dostavi
- **Recepti:** 12 recepata s brojačem porcija
- **Prep:** 18 recepata za pripremu unaprijed i nedjeljni redoslijed

Radi bez interneta i može se instalirati na mobitel.

## Na mobitelu

Aplikacija se nakon svake promjene na `main` sama objavi na **https://brunogudelj.github.io/kuharica/**.

Otvori tu adresu na mobitelu i dodaj je na početni zaslon:

- **Android (Chrome):** izbornik ⋮ → _Dodaj na početni zaslon_ / _Instaliraj aplikaciju_
- **iPhone (Safari):** gumb za dijeljenje → _Dodaj na početni zaslon_

Nakon prvog otvaranja radi i bez interneta, a nova verzija se učita sama kad je objavljena.

## Uređivanje u Codespaceu (bez ičega na računalu)

1. Na GitHubu otvori repozitorij → zeleni gumb **Code** → kartica **Codespaces** → **Create codespace on main**.
2. Pričekaj da se sve instalira. Aplikacija se sama pokrene, a pregled se otvori u kartici **Ports** (port 5173).
3. U terminalu Codespacea možeš pokrenuti i `claude` (Claude Code je već instaliran).
4. Kad nešto promijeniš, napravi commit i push na `main`. GitHub Actions ponovno objavi aplikaciju za oko 2 minute.

Codespace se sam ugasi nakon 30 minuta neaktivnosti. Besplatni GitHub račun ima mjesečni limit sati za Codespaces.

## Pokretanje na računalu (po želji)

Treba Node 20 ili noviji.

```bash
npm install
npm run dev        # razvoj na http://localhost:5173
npm test           # testovi logike
npm run build      # produkcijski build u dist/
npm run preview    # pregled builda
npm run lint
```

## Kako se vodi inventar

1. **Prvi popis (jednom, 10–15 min):** u kartici _Zaliha_ prođi zamrzivač, hladnjak, smočnicu i svježe. Plus i minus mijenjaju količinu za tipičnu porciju, a dodir na naziv otvara točan unos i cijenu pakiranja. Zatvoreno prepiši s deklaracije, a otvoreno procijeni. Začine i umake ne mjeri precizno.
2. **Što se bilježi samo:**
   - _Skuhano_ (Plan) i _Skuhao sam_ (Recepti) skidaju sastojke recepta i dnevne dodatke (miso, posni sir, salate). Ako ima pripremljenog, troši se ono umjesto sirovog.
   - _Pojeo sam_ (Omlet) skida sastojke omleta.
   - _Napravio sam_ (Prep) skida sirove sastojke i dodaje vrećice ili kutije u pripremljeno.
   - _Kupio_ (Kupovina) dodaje pakiranja i bilježi procjenu troška.
3. **Što bilježiš ručno (minus u Zalihi):** ono što si pojeo izvan plana, što se pokvarilo ili bacio, te drugačija pakiranja od predloženih.
4. **Tjedna provjera (nedjelja, 5 min):** u Zalihi uključi filter _Nisko i nema_ i provjeri te stavke u stvarnosti, posebno svježe povrće. Zatim otvori Kupovinu.

Svaka radnja ima _Poništi_ 6 sekundi.

## Dodavanje recepta

Podaci su u `src/data/`:

- **Nova namirnica:** `items.ts` → `ITEMS`. Polja: `id`, `n` (naziv), `cat` (`frz` zamrzivač, `fri` hladnjak, `dry` smočnica, `fre` svježe), `src` (`K`, `BIO`, `AZ`), `u` (`g`, `ml`, `kom`), `min` (minimalna zaliha), `pack` (veličina pakiranja), `step` (korak za + i −), `hint`.
- **Novi recept:** `recipes.ts` → `RECIPES`. Količine su za **1,5 porcija**. Polja: `id`, `n`, `c` (`Riža`, `Krumpir`, `Tjestenina`), `d` (način i vrijeme), `use` (id namirnice → količina; iz ovoga se skida zaliha i računa kupovina), `ing` (tekst sastojaka, brojevi u `<span class=g>…</span>` se skaliraju s porcijama), `st` (koraci), po želji `two` i `split` za jela „2 u 1”.
- **Recept koristi prep:** `prep.ts` → `REC_USE_PREP` (što troši iz pripremljenog) i `REC_PREP` (prijedlog „Brže uz prep”).
- **Novi prep:** `prep.ts` → `PREP` i `PREP_INV` (`make` jedinica po turi, `unit`, `per` = koje sirove sastojke jedna jedinica zamjenjuje u receptu).
- **Omleti:** `omlet.ts` → `OM_FILL` (nadjev s `pre`, `post` ili `mixin` korakom), `OM_PROT` ili `OM_VEG` (u kojoj je skupini), `OM_PRESETS` (gotove kombinacije), `MAC` (kcal i proteini po jedinici).

Nakon promjene pokreni `npm test`.

## Laptop i mobitel (sinkronizacija)

Podaci (zaliha, plan, omleti, troškovi) mogu biti isti na svim uređajima. Čuvaju se u tajnoj datoteci `kuharica.json` u tvom GitHub Gistu.

1. U aplikaciji otvori **Troškovi → Laptop i mobitel** (ili dodirni „Poveži laptop i mobitel” na vrhu).
2. Otvori link **GitHub → novi token**. Dozvola `gist` je već odabrana, a ti odaberi trajanje i stisni _Generate token_.
3. Zalijepi token i stisni **Poveži**. Prvi uređaj napravi gist s trenutnim podacima.
4. Na drugom uređaju zalijepi isti token. Aplikacija sama pronađe gist i preuzme podatke.

Promjene se šalju 2 sekunde nakon zadnje izmjene, a s GitHuba se povlače pri svakom otvaranju aplikacije. Ako mijenjaš na oba uređaja u isto vrijeme, vrijedi zadnja promjena. Bez interneta sve radi na uređaju i šalje se kad se veza vrati. Postavke prikaza (otvorena kartica, brojač porcija) ostaju po uređaju.

Token ima samo dozvolu za gistove i sprema se samo u preglednik tog uređaja. Kad istekne, aplikacija to javi, a ti napravi novi i ponovno poveži.

## Backup

U kartici _Troškovi_, na dnu, su **Izvezi podatke** (JSON datoteka) i **Uvezi podatke**.

## Struktura

```
src/
  data/        namirnice, recepti, prep, omleti (izvučeno iz prototipa)
  logic/       izračuni kao čiste funkcije + testovi
  storage/     spremanje (IndexedDB), izvoz i uvoz
  state/       stanje aplikacije i poništavanje
  components/  zajednički dijelovi sučelja
  tabs/        sedam kartica
  styles/      CSS s temama
reference/     originalni prototip (jedna HTML datoteka)
docs/          specifikacija i plan
scripts/       izvlačenje podataka iz prototipa
```
