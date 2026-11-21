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
- [x] Percorso a passi (21 passi, dai fatti a memoria ai riporti grandi) con tempo per passo, livello e allenamento; ★ sul prossimo passo, anche in home (note dal sito 2026-11-21)
- [x] Radar in secondi per domanda (scala log comune) con media pesata nel tempo, barre d'errore e 4 poligoni di livello (note dal sito 2026-11-21)
- [x] Test per passi (2 domande per passo) e mai la stessa domanda due volte di fila (note dal sito 2026-11-21)
- [x] Script di analisi in `tools/` e procedura di analisi periodica in CLAUDE.md (nota dal sito 2026-11-21)
- [ ] Tarare i tempi di riferimento dei passi e i livelli (ora stime) con i dati di qualche settimana
- [x] Analisi dei dati con l'export del 21/11 (risultati nel Log)
- [ ] Verificare le ipotesi: + e − fatti a 1 cifra (mai misurati), + 2 cifre con 1 riporto rispetto a × con riporto
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
- Percorso a passi invece di abilità generiche (2026-11-21): ogni passo fissa cifre e riporti, così si sale per gradi (tabelline nei due sensi → 1×2 cifre senza riporto → riporto piccolo → grande; per + e − fatti a 1 cifra → 2 cifre con 0, 1, 2 riporti → 3 cifre). Per × e ÷ si usa la grandezza del riporto (0, 1–3, 4–8), non il numero di riporti, perché nei dati del 2026-11-20 era la grandezza a spiegare il tempo. Le domande già salvate vengono riclassificate dagli operandi.
- Stima del tempo di un passo o abilità: media di log(ms) pesata in modo esponenziale nel tempo (emivita 7 giorni), ± 1 errore standard dalla dimensione effettiva del campione; salti contano almeno 10 s, ogni tempo è tagliato a 20 s. Prima era la mediana delle ultime 40 domande: un solo allenamento lungo riempiva la finestra.
- Livelli: tempo = riferimento × k, con k = 45 / punteggio nella Classica (25, 40, 55, 75 → Principiante, Intermedio, Avanzato, Pro). Riferimenti di +, −, × dal foglio di Alessio (per arrivare a 45), il resto stimato: non esistono norme pubblicate per questi tempi.
- Bug corretto (2026-11-21): l'allenamento "tabellina del N" usava il secondo fattore fino a 100, quindi 9 domande su 10 erano 1×2 cifre e non contavano come tabelline; ora 2–12.
- Il nome Zetamac non si usa: la modalità di riferimento si chiama "Classica".

## Log
- 2026-11-21: analisi dell'export del 21/11 (1960 domande): ×/÷ oltre le tabelline, il salto è fra senza riporto e con riporto (× 2,4 → 5,4 → 6,5 s; ÷ 2,6 → 5,5 → 5,5 s), più che fra riporto piccolo e grande; × senza riporto migliorato molto con l'allenamento (3,5 → 2,2 s), tabelline × 1,48 → 1,28 s, decimali 18,6 → 9,6 s. Fatti lenti: 5×8, 6×9, 6×8, 4×9, 6×7, 3×8, 4×7, 4×8 (2,1–2,8 s contro 1,4 di mediana). ÷ tabelline più lente di × (1,8 contro 1,4 s, 16% errori). + e − hanno pochi dati (20–30 per passo) e i fatti a 1 cifra non sono mai stati misurati. Il "Tabelline 12" della nota era la finestra delle ultime 40 domande, piena dell'allenamento sul 12: risolto dalla media pesata su tutte le domande.
- 2026-11-21: note dal sito: percorso a 21 passi, radar in secondi con livelli e barre d'errore, media pesata nel tempo, test per passi, niente domanda ripetuta, corretto l'allenamento delle tabelline, script di analisi in `tools/`.
- 2026-11-20: nota dal sito: grafici per modalità con un punto per domanda (prima provato un punto per partita, scartato: pochi dati), asse tagliato al 95° percentile; punti a partita solo nella Classica e nelle partite importate (che non hanno tempi).
- 2026-11-20: analisi dei primi 763 tempi: il gruppo lento è il riporto (×/÷ 1×2 cifre, + e − con 2 riporti/prestiti); × e ÷ oltre le tabelline ora classificate per riporto, con allenamenti mirati.
- 2026-11-20: modalità Test delle abilità e grafico radar delle 7 abilità, con allenamento sulle 2 più deboli.
- 2026-11-19: progetto avviato (dal task Google "fare reverse-engineer con zetamac"): MVP completo e pubblicato; lacune normalizzate per lunghezza del risultato; import dei punteggi passati (file in Dati-personali, non nel repo), grafico con la media del giorno; statistiche su un'unica pagina (riepilogo di tutte le modalità con "Gioca", un grafico per modalità); moduli leggibili su mobile.
