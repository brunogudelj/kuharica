# Plan

Prijenos prototipa (`reference/kuharica-prototip.html`) u Vite + React + TypeScript, prema `docs/PROJEKT.md`.

1. **Podaci** se izvlače skriptom `scripts/izvuci-podatke.mjs` izravno iz prototipa, pa su preneseni doslovno (75 namirnica, 12 recepata, 18 prep recepata, 22 nadjeva i 15 omleta).
2. **Logika** (`src/logic`) je prenesena kao čiste funkcije koje primaju cijelo stanje (`AppData`) umjesto globalnih varijabli. Radnje (`cook`, `makePrep`, `eatOmlet`, `buy`, `addReceipt`…) vraćaju novo stanje.
3. **Poništavanje:** svaka radnja s toastom pamti prethodno stanje, pa _Poništi_ vraća točno ono što je bilo, uključujući pripremljeno, plan i troškove.
4. **Stanje i spremanje:** jedan `AppData` objekt u React contextu sprema se s odgodom od 500 ms u IndexedDB iza sučelja `Storage`. Uvoz prolazi kroz `migrate()`, koji provjerava i dopunjuje podatke.
5. **Sučelje:** CSS je preuzet iz prototipa (tokeni, svijetla i tamna tema), a kartice su React komponente s istim tekstovima.
6. **PWA:** `vite-plugin-pwa` s precacheom svih datoteka i cacheom fontova.

## Razlike prema prototipu

- U prototipu se spremalo u bazu Claude artefakta. Ovdje se sprema lokalno, uz izvoz i uvoz za backup i prijenos.
- Brojač porcija i množitelj prepa spremaju se uz ostale podatke (u prototipu su bili samo u pregledniku).

## Faza 2 (čeka odluku)

- Sinkronizacija između uređaja (npr. Supabase) kao druga implementacija `Storage`.
- Cijene iz cijene.dev API-ja za Kaufland.
- Objava na GitHub Pages.
