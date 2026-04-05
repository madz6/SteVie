"""
Layer 1: Spatial, Visual & ATS Parsing

1A. ATS Format Traps
    - Multi-column detection (PDF bbox X-coordinate spread)
    - Hidden text boxes (DOCX w:txbxContent XML)
    - Headers/footers flagging
    - Ghost text (text_color == background_color)
1B. Spatial Balance & Typography
    - Font hierarchy (header_size >= body_size * 1.1)
    - Whitespace ratio (target 25%-55%)
    - Section order vs career_stage expected order
"""
from __future__ import annotations

from statistics import median

from .constants import EXPECTED_SECTION_ORDER
from .models import (
    AuditResult,
    BulletError,
    ParsedDocument,
    SpatialBlock,
    StructuralAnalysis,
)


def run_layer1(result: AuditResult) -> AuditResult:
    doc = result.doc
    sa = result.structural

    _check_multi_column(doc, sa)
    _check_hidden_text_boxes(doc, sa)
    _check_headers_footers(doc, sa)
    _check_ghost_text(doc, sa)
    _check_font_hierarchy(doc, sa)
    _check_whitespace_ratio(doc, sa)
    _check_section_order(doc, sa)

    return result


# ---------------------------------------------------------------------------
# 1A  ATS Format Traps
# ---------------------------------------------------------------------------

def _check_multi_column(doc: ParsedDocument, sa: StructuralAnalysis) -> None:
    """Overlapping Y with large X-gap = multi-column layout."""
    if doc.file_type != "pdf" or not doc.spatial_blocks:
        return

    page_blocks: dict[int, list[SpatialBlock]] = {}
    for b in doc.spatial_blocks:
        page_blocks.setdefault(b.page_num, []).append(b)

    for blocks in page_blocks.values():
        for i, a in enumerate(blocks):
            for b in blocks[i + 1:]:
                y_overlap = (
                    min(a.bbox[3], b.bbox[3]) - max(a.bbox[1], b.bbox[1])
                )
                x_gap = abs(a.bbox[0] - b.bbox[0])
                if y_overlap > 5 and x_gap > doc.page_width * 0.3:
                    sa.has_multi_column = True
                    return


def _check_hidden_text_boxes(doc: ParsedDocument, sa: StructuralAnalysis) -> None:
    """DOCX: parse raw XML for w:txbxContent elements."""
    if doc.file_type != "docx":
        return
    body = getattr(doc, "_docx_body", None)
    if body is None:
        return
    try:
        from docx.oxml.ns import qn
        for _ in body.iter(qn("w:txbxContent")):
            sa.has_hidden_text_boxes = True
            return
    except Exception:
        pass


def _check_headers_footers(doc: ParsedDocument, sa: StructuralAnalysis) -> None:
    """Flag text in the top 5% or bottom 5% of any page."""
    if not doc.spatial_blocks:
        return
    margin = doc.page_height * 0.05
    for b in doc.spatial_blocks:
        if b.bbox[1] < margin or b.bbox[1] > doc.page_height - margin:
            if len(b.text.strip()) > 3:
                sa.has_header_footer_text = True
                return


def _check_ghost_text(doc: ParsedDocument, sa: StructuralAnalysis) -> None:
    """text_color == background_color => keyword stuffing."""
    for b in doc.spatial_blocks:
        if b.font and b.font.color == 0xFFFFFF:
            sa.has_ghost_text = True
            return
        if b.font and b.font.color == 16777215:
            sa.has_ghost_text = True
            return


# ---------------------------------------------------------------------------
# 1B  Spatial Balance & Typography
# ---------------------------------------------------------------------------

def _check_font_hierarchy(doc: ParsedDocument, sa: StructuralAnalysis) -> None:
    """header_size >= median_body_size * 1.1"""
    if not doc.spatial_blocks:
        sa.font_hierarchy_valid = True
        return

    sizes = [b.font.size for b in doc.spatial_blocks if b.font and b.font.size > 0]
    if len(sizes) < 3:
        sa.font_hierarchy_valid = True
        return

    body_size = median(sizes)
    header_blocks = [
        b for b in doc.spatial_blocks
        if b.font and (b.font.is_bold or b.font.size > body_size)
        and len(b.text.strip()) < 40
    ]

    if not header_blocks:
        sa.font_hierarchy_valid = False
        return

    max_header_size = max(b.font.size for b in header_blocks)
    sa.font_hierarchy_valid = max_header_size >= body_size * 1.1


def _check_whitespace_ratio(doc: ParsedDocument, sa: StructuralAnalysis) -> None:
    """Target 25-55% empty space."""
    if not doc.spatial_blocks:
        sa.whitespace_ratio = 0.5
        return

    total_page_area = doc.page_height * doc.page_width * max(doc.page_count, 1)
    text_area = 0.0
    for b in doc.spatial_blocks:
        w = abs(b.bbox[2] - b.bbox[0])
        h = abs(b.bbox[3] - b.bbox[1])
        text_area += w * h

    if total_page_area > 0:
        sa.whitespace_ratio = 1.0 - (text_area / total_page_area)
    else:
        sa.whitespace_ratio = 0.5

    sa.whitespace_ratio = max(0.0, min(1.0, sa.whitespace_ratio))


def _check_section_order(doc: ParsedDocument, sa: StructuralAnalysis) -> None:
    """Compare detected section order against career_stage expected order."""
    core_sections = {"experience", "education", "skills"}
    detected = [
        s.name for s in sorted(doc.sections, key=lambda s: s.y_position)
        if s.name in core_sections
    ]

    sa.detected_section_order = detected
    expected = EXPECTED_SECTION_ORDER.get(doc.career_stage.value, [])
    sa.expected_section_order = expected

    if not detected or not expected:
        sa.section_order_valid = True
        return

    sa.section_order_valid = detected == expected
