#!/usr/bin/env python3
"""Generate the simulated lab-report PDFs (R1, R2) from the seed JSON files.

The PDFs are extraction-pipeline fixtures: they look like real Italian
"rapporti di prova" (header, parameter tables with decimal commas, methods,
lab-claimed limits, a technical judgement) so the Claude extraction step can
be developed and tested end-to-end against them.

Usage:  python3 seed/tools/generate_report_pdfs.py
Output: seed/reports/pdf/*.pdf
"""

import json
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

SEED = Path(__file__).resolve().parent.parent
OUT = SEED / "reports" / "pdf"

styles = getSampleStyleSheet()
S_TITLE = ParagraphStyle("t", parent=styles["Title"], fontSize=14, spaceAfter=2)
S_SUB = ParagraphStyle("s", parent=styles["Normal"], fontSize=8, textColor=colors.grey, alignment=1)
S_H = ParagraphStyle("h", parent=styles["Heading2"], fontSize=10, spaceBefore=10, spaceAfter=4)
S_N = ParagraphStyle("n", parent=styles["Normal"], fontSize=8)
S_CELL = ParagraphStyle("c", parent=styles["Normal"], fontSize=7.5, leading=9)

DISCLAIMER = ("DOCUMENTO SIMULATO A SCOPO DI SVILUPPO SOFTWARE - non costituisce "
              "un rapporto di prova reale. Laboratorio, firme e accreditamenti sono fittizi.")


def cell(text):
    return Paragraph(str(text), S_CELL)


def kv_table(rows):
    t = Table([[cell(f"<b>{k}</b>"), cell(v)] for k, v in rows], colWidths=[45 * mm, 125 * mm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbbbbb")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f4f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t


def param_table(header, rows, widths):
    data = [[cell(f"<b>{h}</b>") for h in header]] + [[cell(v) for v in r] for r in rows]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbbbbb")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dde7dd")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    return t


def doc_start(story, lab, title_no):
    story.append(Paragraph(lab, S_TITLE))
    story.append(Paragraph(DISCLAIMER, S_SUB))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"<b>RAPPORTO DI PROVA N. {title_no}</b>", S_H))


def build_r1():
    rj = json.loads((SEED / "reports" / "R1-26M51914-170903-sond-B4.json").read_text())
    h = rj["extraction"]["header"]
    story = []
    doc_start(story, "LabAnalysis S.r.l. (SIMULATO)", h["report_number"])
    story.append(kv_table([
        ("Committente", "Bonifiche Ambientali Nord S.p.A. - Corso Regio Parco 88, Torino"),
        ("Descrizione campione", h["waste_description"]),
        ("Codice EER dichiarato", h["eer_declared"]),
        ("Stato fisico", h["physical_state"]),
        ("Data campionamento", "12/05/2026"),
        ("Data rapporto di prova", "19/05/2026"),
        ("Campionamento effettuato da", h["sampled_by"]),
        ("Metodo di digestione", h["digestion_method"]),
        ("Note", h["notes"]),
    ]))
    story.append(Paragraph("RISULTATI ANALITICI (sul tal quale)", S_H))
    rows = [[p_label(p), p["result_raw"], p["unit"], p["method"]]
            for p in rj["extraction"]["parameters"]]
    story.append(param_table(["Parametro", "Risultato", "U.M.", "Metodo"], rows, [55, 22, 25, 68]))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Il presente rapporto di prova si riferisce esclusivamente al campione sottoposto ad analisi. "
        "La classificazione del rifiuto e la valutazione di ammissibilita presso l'impianto di "
        "destinazione restano a carico del detentore e del gestore.", S_N))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Il Responsabile di Laboratorio - Dr.ssa Chim. Laura Bianchi (firma simulata)", S_N))
    out = OUT / "R1-26M51914_170903_sond_B4.pdf"
    SimpleDocTemplate(str(out), pagesize=A4, topMargin=15 * mm, bottomMargin=15 * mm).build(story)
    return out


LABELS = None

def p_label(p):
    global LABELS
    if LABELS is None:
        reg = json.loads((SEED / "analytes.json").read_text())["analytes"]
        LABELS = {a["key"]: a["label"].replace("≤", "<=") for a in reg}
    return LABELS.get(p["analyte_key"], p["analyte_key"])


def build_r2():
    rj = json.loads((SEED / "reports" / "R2-2026-ANAL-0842-170504.json").read_text())
    h = rj["extraction"]["header"]
    params = rj["extraction"]["parameters"]
    story = []
    doc_start(story, "Laboratorio Chimico Ambientale S.r.l. (SIMULATO)", h["report_number"])
    story.append(Paragraph(
        "Ai fini della caratterizzazione e classificazione del rifiuto "
        "(Rif. D.Lgs. 152/06 e s.m.i. - Reg. UE 1357/2014 - Reg. UE 2019/1021 sui POP)", S_N))
    story.append(Spacer(1, 4))
    story.append(kv_table([
        ("Richiedente", "Azienda Esempio S.r.l. - Via delle Industrie 10, Milano"),
        ("Descrizione campione", h["waste_description"]),
        ("Codice EER presunto", h["eer_declared"]),
        ("Stato fisico", h["physical_state"]),
        ("Data ricevimento campione", "20/07/2026"),
        ("Data emissione", "26/07/2026"),
        ("Campionamento effettuato da", h["sampled_by"]),
    ]))

    total = [p for p in params if p["basis"] == "total"]
    eluate = [p for p in params if p["basis"] == "eluate"]

    story.append(Paragraph("1. ANALISI SUL TAL QUALE (sostanze organiche, metalli e inquinanti persistenti)", S_H))
    rows = [[p_label(p), p["result_raw"], p["unit"], p["method"]] for p in total]
    story.append(param_table(["Parametro", "Risultato", "U.M.", "Metodo"], rows, [55, 22, 25, 68]))

    story.append(Paragraph("2. TEST DI CESSIONE / ANALISI DELL'ELUATO", S_H))
    story.append(Paragraph("Preparazione dell'eluato secondo UNI EN 12457-2 - Rapporto L/S = 10 l/kg", S_N))
    story.append(Spacer(1, 3))
    rows = [[p_label(p), p["result_raw"], p["unit"], p.get("lab_claimed_limit", "-"), p["method"]]
            for p in eluate]
    story.append(param_table(
        ["Parametro eluato", "Risultato", "U.M.", "Limite ammiss. discarica inerti", "Metodo"],
        rows, [48, 18, 22, 28, 54]))

    story.append(Paragraph("3. GIUDIZIO TECNICO", S_H))
    story.append(Paragraph(
        "Sulla base dei risultati analitici e del confronto con i limiti del Reg. UE 1357/2014, il campione "
        "NON presenta caratteristiche di pericolo (HP1-HP15). Il rifiuto e' classificabile come RIFIUTO NON "
        "PERICOLOSO, codice EER 17 05 04. I parametri determinati sull'eluato rientrano nei limiti di "
        "accettabilita' previsti dal D.M. 27/09/2010 per la destinazione Discarica per Rifiuti Inerti.", S_N))
    story.append(Spacer(1, 10))
    story.append(Paragraph("Il Responsabile del Laboratorio - Dr. Chim. Mario Rossi (firma simulata)", S_N))
    out = OUT / "R2-2026_ANAL-0842_170504.pdf"
    SimpleDocTemplate(str(out), pagesize=A4, topMargin=15 * mm, bottomMargin=15 * mm).build(story)
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for fn in (build_r1, build_r2):
        print("scritto:", fn())
