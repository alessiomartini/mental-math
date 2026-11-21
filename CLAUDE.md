# Claude Code instructions

- Sito statico senza build, pubblicato su GitHub Pages da `main` (repo pubblico `alessiomartini/mental-math`).
- Logica pura in `core.js` (verifica: `node test.js`), UI in `app.js`. Cambiando un asset, alzare il `?v=` in `index.html`.
- Dati dell'utente solo in `localStorage` (`mm-data`): cambiando il formato, restare compatibili con i dati già salvati (campo `v`).
- Non usare il nome o l'aspetto di Zetamac: la modalità si chiama "Classica".
- `notes-widget.js` non si modifica qui (originale in `site-notes/widget/`).
- Analisi periodica dei dati (nota di Alessio, 2026-11-21): quando Alessio salva un export in `E:\Alessio\Dati-personali\mental-math`, lanciare `python -X utf8 tools/analisi_panoramica.py <export>` e `tools/analisi_riporti.py <export>`, cercare i gruppi lenti e quelli facili, proporre ipotesi da verificare con i passi più semplici (`STEPS` in `core.js`) e riportare i risultati nel `## Log` del ROADMAP. I dati non entrano mai nel repo (è pubblico).
