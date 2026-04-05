"""
Layer 4: Positional Weighting (Above The Fold)

- Compute is_above_fold = y_position < (page_height * 0.30) for every bullet
- Apply 1.5x multiplier to above-fold bullet specificity scores
- Compute above_fold_score = (achievements_above_fold / total_bullets_above_fold) * 100
"""
from __future__ import annotations

import re

from .constants import APPROVED_STRONG_VERBS
from .models import AuditResult, Bullet


def run_layer4(result: AuditResult) -> AuditResult:
    doc = result.doc
    page_height = doc.page_height
    fold_threshold = page_height * 0.30

    achievements_above = 0
    total_above = 0

    for bullet in doc.bullets:
        bullet.is_above_fold = bullet.y_position < fold_threshold and bullet.y_position > 0

        _compute_specificity(bullet)

        if bullet.is_above_fold:
            bullet.specificity_score *= 1.5
            total_above += 1
            if bullet.is_achievement:
                achievements_above += 1

    if total_above > 0:
        result.scores.above_fold_score = (achievements_above / total_above) * 100
    else:
        result.scores.above_fold_score = 0.0

    return result


def _compute_specificity(bullet: Bullet) -> None:
    """Count specificity signals in a bullet."""
    text = bullet.text
    signals = 0

    if re.search(r'\d+', text):
        signals += 1

    tool_pattern = re.compile(
        r'\b(?:Python|SQL|Agile|Figma|Jira|Tableau|Excel|React|AWS|GCP|Azure|'
        r'Docker|Kubernetes|Scrum|Kanban|JTBD|OKR|PRD|Notion|Power\s*BI|'
        r'Snowflake|dbt|Looker|Mixpanel|Amplitude)\b',
        re.I,
    )
    if tool_pattern.search(text):
        signals += 1

    deliverable_pattern = re.compile(
        r'\b(?:PRD|pitch\s*deck|financial\s*model|sprint\s*plan|roadmap|'
        r'strategy\s*report|dashboard|pipeline|framework|prototype|MVP)\b',
        re.I,
    )
    if deliverable_pattern.search(text):
        signals += 1

    stakeholder_pattern = re.compile(
        r'\b(?:client\s*leadership|engineering\s*team|C-suite|board|'
        r'senior\s*management|cross-functional|stakeholders|founders?)\b',
        re.I,
    )
    if stakeholder_pattern.search(text):
        signals += 1

    timeframe_pattern = re.compile(
        r'\b(?:\d+\s*(?:week|month|day|year|sprint|quarter)s?|Q[1-4]\s*\d{4}|by\s+Q[1-4])\b',
        re.I,
    )
    if timeframe_pattern.search(text):
        signals += 1

    scope_pattern = re.compile(
        r'\b(?:across\s+\d+|over\s+\d+|\d+\s*(?:product|market|region|team|client|user)s?)\b',
        re.I,
    )
    if scope_pattern.search(text):
        signals += 1

    bullet.specificity_score = float(signals)
