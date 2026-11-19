# Roadmap

## MVP
- [x] Modalità Classica (120 s, + − × ÷, avanzamento automatico)
- [x] Modalità tabelline, tabelline estese, decimali, numeri grandi, personalizzata
- [x] Salvataggio automatico di ogni domanda nel browser, Esporta/Importa JSON
- [x] Analisi delle lacune con allenamento mirato per ognuna
- [x] Grafico dei punteggi per modalità, statistiche per operazione
- [x] Feedback (site-notes), tema chiaro/scuro
- [x] Importati i punteggi passati di Zetamac dal foglio Google (215 partite, solo punteggi: niente tempi per domanda, quindi non entrano nell'analisi delle lacune)
- [ ] Giocare qualche settimana e tarare le soglie delle lacune (ora: n ≥ 10, mediana ≥ 1,25× la propria operazione)

## Idee
- [ ] Sincronizzazione fra dispositivi: Worker + D1 con un "codice di sincronizzazione" (niente login)
- [ ] Domande da colloquio quant: percentuali, frazioni ↔ decimali, quadrati, stime
- [ ] Ripetizione dilazionata dei singoli fatti lenti (es. 7×8) dentro la partita normale
- [ ] PWA installabile e offline

## Decisioni e cose provate
- Dati nel `localStorage`, niente account: zero attrito e nessun dato personale su un server; limite: un solo browser, si perde se si cancellano i dati del sito (mitigato con `navigator.storage.persist()` ed Esporta). La sincronizzazione è in Idee.
- Le lacune confrontano tipi simili: ogni tempo viene prima diviso per la mediana delle domande con la stessa operazione e la stessa lunghezza del risultato (il tempo grezzo misura soprattutto la grandezza dei numeri, e le modalità mescolano numeri piccoli e grandi), poi si confrontano i tag (×7, addizioni con 2 riporti, decimali...) su quel rapporto. Gli errori di battitura contano da soli solo con n ≥ 20 (sono rumorosi).
- Evidenza: la pratica mirata sui fatti lenti e il recupero ripetuto funzionano soprattutto negli studi su bambini; sugli adulti l'evidenza è debole.
- Il nome Zetamac non si usa: la modalità di riferimento si chiama "Classica".

## Log
- 2026-11-19: progetto avviato (dal task Google "fare reverse-engineer con zetamac"): MVP completo e pubblicato.
