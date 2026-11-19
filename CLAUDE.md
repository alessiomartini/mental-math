# Claude Code instructions

- Sito statico senza build, pubblicato su GitHub Pages da `main` (repo pubblico `alessiomartini/mental-math`).
- Logica pura in `core.js` (verifica: `node test.js`), UI in `app.js`. Cambiando un asset, alzare il `?v=` in `index.html`.
- Dati dell'utente solo in `localStorage` (`mm-data`): cambiando il formato, restare compatibili con i dati già salvati (campo `v`).
- Non usare il nome o l'aspetto di Zetamac: la modalità si chiama "Classica".
- `notes-widget.js` non si modifica qui (originale in `site-notes/widget/`).
