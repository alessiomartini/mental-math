# Mental Math

Sito statico per allenare il calcolo mentale a tempo (stile drill da colloquio quant):
https://alessiomartini.github.io/mental-math/

- **Classica**: 120 s, addizioni (2–100) + (2–100), moltiplicazioni (2–12) × (2–100), sottrazioni e divisioni come operazioni inverse. La risposta giusta passa da sola alla prossima.
- **Altre modalità**: tabelline, tabelline estese (2–20), decimali, numeri grandi, oppure personalizzata (operazioni, intervalli, cifre decimali, durata).
- **Statistiche automatiche**: ogni domanda viene salvata (tempo, errori di battitura) nel `localStorage` del browser. Niente account; Esporta/Importa JSON per backup o per cambiare dispositivo.
- **Lacune**: confronta il tempo mediano per tipo di domanda (×7, ÷7, addizioni con 2 riporti, decimali…) con quello della sua operazione e propone un allenamento mirato per ognuna.

## Avviare in locale

```
python -m http.server 8768
```

poi http://localhost:8768. Test della logica: `node test.js`.

## File

- `core.js`: generazione delle domande, tag, controllo risposta, analisi delle lacune (niente DOM).
- `app.js`: interfaccia, partita, salvataggio, statistiche.
- `notes-widget.js`: box Feedback condiviso (copia identica da `site-notes`).
