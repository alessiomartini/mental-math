# Roadmap

## MVP
- [x] Modalità Classica (120 s, + − × ÷, avanzamento automatico)
- [x] Modalità tabelline, tabelline estese, decimali, numeri grandi, personalizzata
- [x] Salvataggio automatico di ogni domanda nel browser, Esporta/Importa JSON
- [x] Analisi delle lacune con allenamento mirato per ognuna
- [x] Grafico dei punteggi per modalità, statistiche per operazione
- [x] Feedback (site-notes), tema chiaro/scuro
- [x] Importati i punteggi passati di Zetamac dal foglio Google (215 partite, solo punteggi: niente tempi per domanda, quindi non entrano nell'analisi delle lacune)
- [x] Test delle abilità (42 domande, 6 per 7 abilità, senza tempo, con Salta) e grafico radar delle abilità nelle statistiche
- [x] Grafici per modalità con un punto per ogni domanda (tempo) e linea = mediana delle ultime 25; la Classica tiene anche i punti a partita (nota dal sito, 2026-11-20)
- [ ] Tarare i tempi obiettivo delle abilità tabelline, numeri grandi e decimali (ora stime)
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
- Punteggio di un'abilità = tempo obiettivo / tempo mediano sulle ultime 40 domande, max 100. Obiettivi di addizioni, sottrazioni, moltiplicazioni e divisioni dal foglio di Alessio (quelli per arrivare a 45+ nella Classica); tabelline, numeri grandi e decimali stimati. Gli errori non entrano nel punteggio (restano in tabella e nelle lacune). Il radar usa tutte le partite, non solo i test; il test serve a coprire tutte le abilità in modo uniforme.
- × e ÷ oltre le tabelline (secondo fattore o quoziente ≥ 13) si classificano per riporto unità→decine (0, 1–3, 4–8), non per fattore: nei dati del 2026-11-20 il riporto spiega quasi tutto (senza 3,4 s, riporto 2–5 6–8 s; modello log-lineare: riporto ≥1 ×1,6, ≥4 un altro ×1,4), il fattore quasi niente. Prima i tag per fattore (×4, ×8) davano allenamenti sbagliati: misuravano i riporti. Non clustering non supervisionato: con poche centinaia di domande serve spiegare il tempo con caratteristiche leggibili (riporti, cifre), non trovare gruppi senza nome.
- Il nome Zetamac non si usa: la modalità di riferimento si chiama "Classica".

## Log
- 2026-11-20: nota dal sito: grafici per modalità con un punto per domanda (prima provato un punto per partita, scartato: pochi dati), asse tagliato al 95° percentile; punti a partita solo nella Classica e nelle partite importate (che non hanno tempi).
- 2026-11-20: analisi dei primi 763 tempi: il gruppo lento è il riporto (×/÷ 1×2 cifre, + e − con 2 riporti/prestiti); × e ÷ oltre le tabelline ora classificate per riporto, con allenamenti mirati.
- 2026-11-20: modalità Test delle abilità e grafico radar delle 7 abilità, con allenamento sulle 2 più deboli.
- 2026-11-19: progetto avviato (dal task Google "fare reverse-engineer con zetamac"): MVP completo e pubblicato; lacune normalizzate per lunghezza del risultato; import dei punteggi passati (file in Dati-personali, non nel repo), grafico con la media del giorno; statistiche su un'unica pagina (riepilogo di tutte le modalità con "Gioca", un grafico per modalità); moduli leggibili su mobile.
