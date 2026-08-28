from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, HRFlowable
)

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "obsidian/02-Arquitetura/Briefing Visual - Como funciona o HealthLink Sentinel.md"
OUTPUT = ROOT / "output/pdf/HealthLink Sentinel - Briefing Visual do Sistema.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

FONT = Path("C:/Windows/Fonts/segoeui.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/seguisb.ttf")
FONT_MONO = Path("C:/Windows/Fonts/consola.ttf")
pdfmetrics.registerFont(TTFont("SegoeUI", str(FONT)))
pdfmetrics.registerFont(TTFont("SegoeUI-Semibold", str(FONT_BOLD)))
pdfmetrics.registerFont(TTFont("Consolas", str(FONT_MONO)))

NAVY = colors.HexColor("#07111D")
PANEL = colors.HexColor("#0D1C2B")
PANEL_2 = colors.HexColor("#12263A")
CYAN = colors.HexColor("#35D7FF")
GREEN = colors.HexColor("#4AE3A3")
WHITE = colors.HexColor("#EAF6FF")
MUTED = colors.HexColor("#9DB2C6")
GRID = colors.HexColor("#29445C")
YELLOW = colors.HexColor("#FFD166")


class HealthLinkDoc(BaseDocTemplate):
    pass


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, w, h, fill=1, stroke=0)
    canvas.setStrokeColor(GRID)
    canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)
    canvas.setFont("SegoeUI-Semibold", 8)
    canvas.setFillColor(CYAN)
    canvas.drawString(18 * mm, h - 10 * mm, "HEALTHLINK SENTINEL")
    canvas.setFont("SegoeUI", 7)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(w - 18 * mm, h - 10 * mm, "BRIEFING VISUAL DO SISTEMA")
    canvas.line(18 * mm, 13 * mm, w - 18 * mm, 13 * mm)
    canvas.drawString(18 * mm, 8.5 * mm, "Documento executivo e técnico • 11 ago 2026")
    canvas.drawRightString(w - 18 * mm, 8.5 * mm, f"{doc.page:02d}")
    canvas.restoreState()


styles = getSampleStyleSheet()
body = ParagraphStyle("Body", fontName="SegoeUI", fontSize=9.2, leading=14, textColor=WHITE, spaceAfter=7)
h1 = ParagraphStyle("H1", fontName="SegoeUI-Semibold", fontSize=19, leading=23, textColor=CYAN, spaceBefore=10, spaceAfter=10)
h2 = ParagraphStyle("H2", fontName="SegoeUI-Semibold", fontSize=13, leading=17, textColor=GREEN, spaceBefore=9, spaceAfter=7)
h3 = ParagraphStyle("H3", fontName="SegoeUI-Semibold", fontSize=10.5, leading=14, textColor=YELLOW, spaceBefore=7, spaceAfter=5)
bullet = ParagraphStyle("Bullet", parent=body, leftIndent=12, firstLineIndent=-8, bulletIndent=2, spaceAfter=4)
small = ParagraphStyle("Small", parent=body, fontSize=7.6, leading=10.5)
callout = ParagraphStyle("Callout", parent=body, fontSize=10, leading=15, textColor=WHITE)
code_style = ParagraphStyle("Code", fontName="Consolas", fontSize=6.8, leading=9.3, textColor=WHITE)
cover_title = ParagraphStyle("CoverTitle", fontName="SegoeUI-Semibold", fontSize=30, leading=35, textColor=WHITE, alignment=TA_LEFT)
cover_sub = ParagraphStyle("CoverSub", fontName="SegoeUI", fontSize=13, leading=20, textColor=CYAN)


def clean_inline(text):
    text = re.sub(r"\[\[([^\]|]+\|)?([^\]]+)\]\]", lambda m: m.group(2), text)
    text = re.sub(r"`([^`]+)`", r'<font name="Consolas" color="#35D7FF">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r'<b>\1</b>', text)
    text = text.replace("&", "&amp;")
    text = text.replace("&amp;lt;", "&lt;").replace("&amp;gt;", "&gt;")
    return text


def panel(flowables, pad=10, bg=PANEL):
    t = Table([[flowables]], colWidths=[166 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.7, GRID),
        ("LEFTPADDING", (0, 0), (-1, -1), pad),
        ("RIGHTPADDING", (0, 0), (-1, -1), pad),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
    ]))
    return t


def diagram_block(code):
    lines = [x.rstrip() for x in code.splitlines() if x.strip()]
    kind = "DIAGRAMA DE SEQUÊNCIA" if lines and lines[0].startswith("sequenceDiagram") else "MAPA DE RELACIONAMENTOS" if lines and lines[0].startswith("erDiagram") else "FLUXO OPERACIONAL"
    rendered = []
    for line in lines[1:]:
        s = line.strip()
        s = re.sub(r"^(actor|participant)\s+\w+\s+as\s+", "• ", s)
        s = re.sub(r"^[A-Za-z0-9_]+\s*[-=.]+>>?[A-Za-z0-9_]+:\s*", "→ ", s)
        s = re.sub(r"^[A-Za-z0-9_]+\s*-->>?[A-Za-z0-9_]+:\s*", "← ", s)
        s = re.sub(r"^[A-Za-z0-9_]+\s*--?>\|([^|]+)\|\s*", r"→ \1 → ", s)
        s = re.sub(r"^[A-Za-z0-9_]+\s*--?>\s*", "→ ", s)
        s = re.sub(r"^[A-Za-z0-9_]+\s*--[^ ]+\s*", "→ ", s)
        s = re.sub(r"^[A-Z0-9_]+\[\(?[\"']?", "", s)
        s = re.sub(r"[\"']?\)?\]$", "", s)
        s = s.replace("<br/>", " • ").replace("autonumber", "")
        if s and not s.startswith(("subgraph", "end", "stateDiagram", "[*]")):
            rendered.append(s)
    content = [Paragraph(kind, ParagraphStyle("DiagramLabel", parent=small, textColor=CYAN, fontName="SegoeUI-Semibold", spaceAfter=5))]
    for line in rendered[:18]:
        content.append(Paragraph(clean_inline(line), code_style))
    return panel(content, pad=9, bg=colors.HexColor("#091725"))


def markdown_table(rows):
    parsed = [[clean_inline(c.strip()) for c in r.strip().strip("|").split("|")] for r in rows]
    parsed = [r for r in parsed if not all(re.fullmatch(r":?-{3,}:?", re.sub("<[^>]+>", "", c) or "") for c in r)]
    cols = max(len(r) for r in parsed)
    widths = [166 * mm / cols] * cols
    data = []
    for ri, row in enumerate(parsed):
        st = ParagraphStyle(f"Cell{ri}", parent=small, fontName="SegoeUI-Semibold" if ri == 0 else "SegoeUI", textColor=CYAN if ri == 0 else WHITE)
        data.append([Paragraph(c, st) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PANEL_2),
        ("BACKGROUND", (0, 1), (-1, -1), PANEL),
        ("GRID", (0, 0), (-1, -1), 0.45, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


raw = SOURCE.read_text(encoding="utf-8")
raw = re.sub(r"^---\n.*?\n---\n", "", raw, flags=re.S)
lines = raw.splitlines()
story = []

# Cover
story += [Spacer(1, 42 * mm), Paragraph("HEALTHLINK<br/>SENTINEL", cover_title), Spacer(1, 6 * mm), HRFlowable(width="50%", thickness=2, color=CYAN, hAlign="LEFT"), Spacer(1, 8 * mm), Paragraph("Briefing visual do sistema", cover_sub), Spacer(1, 4 * mm), Paragraph("Arquitetura, integrações, APIs e fluxo operacional", ParagraphStyle("CoverDesc", parent=body, fontSize=13, leading=18, textColor=MUTED)), Spacer(1, 56 * mm), panel([Paragraph("CENTRO DE COMANDO PARA UNIDADES MÓVEIS DE SAÚDE", ParagraphStyle("CoverTag", parent=small, fontName="SegoeUI-Semibold", textColor=GREEN)), Paragraph("Documento para produto, operação, tecnologia e gestão", small)], bg=PANEL_2), PageBreak()]

i = 1  # skip source title
while i < len(lines):
    line = lines[i].rstrip()
    if not line:
        i += 1
        continue
    if line.startswith("```mermaid"):
        block = []
        i += 1
        while i < len(lines) and not lines[i].startswith("```"):
            block.append(lines[i]); i += 1
        story += [Spacer(1, 3 * mm), diagram_block("\n".join(block)), Spacer(1, 4 * mm)]
    elif line.startswith("```text"):
        block = []
        i += 1
        while i < len(lines) and not lines[i].startswith("```"):
            block.append(lines[i]); i += 1
        story += [panel([Paragraph("<br/>".join(clean_inline(x) for x in block), code_style)], bg=colors.HexColor("#091725")), Spacer(1, 3 * mm)]
    elif line.startswith("## "):
        story.append(Paragraph(clean_inline(line[3:]), h1))
    elif line.startswith("### "):
        story.append(Paragraph(clean_inline(line[4:]), h2))
    elif line.startswith("#### "):
        story.append(Paragraph(clean_inline(line[5:]), h3))
    elif line.startswith("|"):
        rows = []
        while i < len(lines) and lines[i].startswith("|"):
            rows.append(lines[i]); i += 1
        story += [markdown_table(rows), Spacer(1, 4 * mm)]
        continue
    elif line.startswith("> [!"):
        title = re.sub(r"^> \[![^]]+\]\s*", "", line) or "DESTAQUE"
        content = []
        i += 1
        while i < len(lines) and lines[i].startswith(">"):
            content.append(lines[i].lstrip("> ")); i += 1
        story += [panel([Paragraph(clean_inline(title.upper()), ParagraphStyle("CallTitle", parent=small, fontName="SegoeUI-Semibold", textColor=CYAN)), Paragraph(clean_inline(" ".join(content)), callout)], bg=PANEL_2), Spacer(1, 4 * mm)]
        continue
    elif re.match(r"^[-*] ", line):
        story.append(Paragraph(clean_inline(line[2:]), bullet, bulletText="•"))
    elif re.match(r"^\d+\. ", line):
        num, txt = line.split(". ", 1)
        story.append(Paragraph(clean_inline(txt), bullet, bulletText=num + "."))
    else:
        story.append(Paragraph(clean_inline(line), body))
    i += 1

doc = HealthLinkDoc(str(OUTPUT), pagesize=A4, leftMargin=22*mm, rightMargin=22*mm, topMargin=20*mm, bottomMargin=18*mm, title="HealthLink Sentinel - Briefing Visual do Sistema", author="HealthLink Sentinel")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal", showBoundary=0)
doc.addPageTemplates([PageTemplate(id="dark", frames=[frame], onPage=header_footer)])
doc.build(story)
print(OUTPUT)
