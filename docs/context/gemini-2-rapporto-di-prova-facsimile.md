# Context — Gemini conversation 2: Fac-simile "Rapporto di Prova" (chemical analysis for waste classification)

> Source: Gemini chat provided by the owner (2026-07-26). Content preserved as pasted,
> lightly reformatted into markdown tables. This document is the reference structure for
> the extraction schema and a Phase-1 test fixture (a "clean pass" counterpart to the
> non-conform 17 09 03* sample in the UI mock-up).

**Prompt:** "Caricami un pdf di un analisi chimica di esempio per classificazione rifiuti con eluato e sostanze persistenti"

---

# RAPPORTO DI PROVA / ANALISI CHIMICA (FAC-SIMILE)

*Ai fini della caratterizzazione e classificazione del rifiuto*
*(Rif. D.Lgs. 152/06 e s.m.i. — Regolamento UE 1357/2014 — Regolamento UE 2019/1021 sui POP)*

## 1. Dati generali

| Campo | Valore |
|---|---|
| Certificato N° | 2026/ANAL-0842 |
| Data emissione | 26/07/2026 |
| Richiedente | Azienda Esempio S.r.l. — Via delle Industrie 10, Milano |
| Campionamento effettuato da | Cliente / Tecnico Abilitato |
| Data ricevimento campione | 20/07/2026 |
| Descrizione campione | Terreno da scavo / processo industriale |
| Codice EER presunto | 17 05 04 (Terre e rocce, diverse da quelle di cui alla voce 17 05 03) |
| Stato fisico | Solido non polverulento |

## 2. Analisi sul tal quale (sostanze organiche, metalli e inquinanti persistenti)

| Parametro | Risultato | U.M. | Limite di rilevabilità | Metodo analitico |
|---|---|---|---|---|
| Sostanza secca (a 105°C) | 88,5 | % | 0,1 | UNI EN 14346:2007 |
| pH (tal quale) | 7,8 | Unità pH | 0,1 | EPA 9045D:2004 |
| Idrocarburi C > 10 | 45 | mg/kg s.s. | 10 | UNI EN 14039:2004 |
| Idrocarburi C ≤ 10 (volatili) | < 1,0 | mg/kg s.s. | 1,0 | EPA 5021A + EPA 8015 D |
| BTEX (benzenici volatili) | < 0,1 | mg/kg s.s. | 0,1 | EPA 5021A + EPA 8260 D |
| PCB (policlorobifenili totali) | < 0,01 | mg/kg s.s. | 0,01 | UNI EN 15308:2008 |
| IPA (idrocarburi policiclici aromatici) | 0,15 | mg/kg s.s. | 0,05 | UNI EN 15527:2008 |

### Inquinanti Organici Persistenti (POP — Reg. UE 2019/1021)

| Parametro | Risultato | U.M. | Limite di rilevabilità | Metodo analitico |
|---|---|---|---|---|
| Diossine e furani (PCDD/PCDF — TEQ) | < 0,0001 | mg/kg s.s. | 0,0001 | EPA 1613B:1994 |
| PFAS (somma sostanze perfluorurate) | < 0,05 | mg/kg s.s. | 0,01 | UNI CEN/TS 15968:2010 |
| Pesticidi organoclorurati (somma) | < 0,01 | mg/kg s.s. | 0,01 | EPA 8081B:2007 |

## 3. Test di cessione / analisi dell'eluato

*(Preparazione dell'eluato secondo norma UNI EN 12457-2 — Rapporto Liquido/Solido L/S = 10 l/kg)*

| Parametro eluato | Risultato | U.M. | Limite ammissibile discarica inerti | Metodo analitico |
|---|---|---|---|---|
| pH dell'eluato | 7,6 | Unità pH | 5,5 – 12,0 | APAT CNR IRSA 2060 |
| Conducibilità elettrica | 420 | µS/cm a 20°C | – | APAT CNR IRSA 2030 |
| Cianuri totali | < 0,01 | mg/l | 0,01 | APAT CNR IRSA 4070 |
| Fluoruri (F⁻) | 0,4 | mg/l | 1,0 | UNI EN ISO 10304-1 |
| Cloruri (Cl⁻) | 25,0 | mg/l | 800 | UNI EN ISO 10304-1 |
| Solfati (SO₄²⁻) | 85,0 | mg/l | 1000 | UNI EN ISO 10304-1 |
| Arsenico (As) | < 0,005 | mg/l | 0,05 | UNI EN ISO 17294-2 |
| Cadmio (Cd) | < 0,001 | mg/l | 0,004 | UNI EN ISO 17294-2 |
| Cromo totale (Cr) | 0,012 | mg/l | 0,05 | UNI EN ISO 17294-2 |
| Rame (Cu) | 0,03 | mg/l | 0,2 | UNI EN ISO 17294-2 |
| Nichel (Ni) | 0,01 | mg/l | 0,04 | UNI EN ISO 17294-2 |
| Piombo (Pb) | < 0,005 | mg/l | 0,05 | UNI EN ISO 17294-2 |
| Mercurio (Hg) | < 0,0005 | mg/l | 0,002 | UNI EN ISO 17294-2 |
| Zinco (Zn) | 0,15 | mg/l | 0,4 | UNI EN ISO 17294-2 |
| DOC (carbonio organico dissolto) | 12,0 | mg/l | 50 | UNI EN 1484:1999 |
| TDS (solidi dissolti totali) | 280 | mg/l | 4000 | Calcolato |

## 4. Giudizio tecnico e valutazione ai fini della classificazione

- **Caratteristiche di pericolosità (HP1 ÷ HP15):** sulla base dei risultati analitici e del confronto con i limiti del Reg. UE 1357/2014, le concentrazioni delle sostanze pericolose e dei POP risultano inferiori alle soglie di cut-off e di concentrazione limite. Il campione **NON** presenta alcuna caratteristica di pericolo.
- **Classificazione EER:** rifiuto classificabile come **NON PERICOLOSO**, codice EER **17 05 04**.
- **Ammissibilità in discarica:** i parametri sull'eluato (UNI EN 12457-2) rientrano nei limiti di accettabilità previsti dal **D.M. 27/09/2010** per la destinazione *Discarica per Rifiuti Inerti*.

*Il Responsabile del Laboratorio / Chimico Abilitato — Dr. Chim. Mario Rossi*

---

## Notes for implementation (not part of the fac-simile)

What this document tells us about real-world reports the extraction pipeline must handle:

1. **Three distinct result sections** — tal quale (mg/kg s.s.), POPs (mg/kg s.s., very low LODs), eluato (mg/l, UNI EN 12457-2 L/S 10) — each mapping to a different `basis` in the data model and to different limit tables.
2. **Below-LOQ notation** (`< 0,05`) is pervasive, including cases where the LOD equals the limit (Cianuri: `< 0,01` vs limit `0,01`) — the rules engine's `<`-semantics matter in practice.
3. **Reports embed their own claimed limits and conclusions** (col. "Limite ammissibile discarica inerti", §4 giudizio). The system must extract them but re-verify independently against its own versioned tables — lab-claimed compliance is never trusted as-is. Note the lab cites **D.M. 27/09/2010** even though landfill acceptance criteria are now in D.Lgs. 121/2020 — old citations in incoming reports are common and must be mapped.
4. **Header fields** match the planned extraction schema (certificato n°, dates, richiedente, EER presunto, stato fisico, sampling responsibility — "campionamento effettuato da Cliente" is itself acceptance-relevant).
5. **Italian number format** (decimal comma) and ranges (`5,5 – 12,0` for pH) must be parsed.
