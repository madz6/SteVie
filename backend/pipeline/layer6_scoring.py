"""
Layer 6: Overall Scoring Model

CV Quality Score (100 pts):
  Impact (40):        Action Verbs (10) + Specificity (15) + Quantification (10) + Avoided Words (5)
  Presentation (30):  Length/Format (5) + Sections (5) + Consistency (10) + Completeness (5) + Spelling (5)
  Competencies (30):  Analytical (6) + Communication (6) + Leadership (6) + Teamwork (6) + Initiative (6)

JD Match Score (100 pts):
  Exact Match (30) + Semantic Match (25) + Experience Match (20) + ATS/Formatting (25)
"""
from __future__ import annotations

import re
from collections import Counter

from .constants import (
    ANALYTICAL_OUTPUTS,
    ANALYTICAL_TOOLS,
    ANALYTICAL_VERBS,
    APPROVED_STRONG_VERBS,
    COMMUNICATION_OUTPUTS,
    COMMUNICATION_VERBS,
    FLAGGED_FILLER_WORDS,
    INITIATIVE_SIGNALS,
    INITIATIVE_VERBS,
    LEADERSHIP_CONTEXTS,
    LEADERSHIP_VERBS,
    TEAMWORK_CONTEXTS,
    TEAMWORK_VERBS,
    WEAK_STARTERS,
)
from .models import (
    AuditResult,
    Bullet,
    KeywordStatus,
    KeywordTier,
    ScoreBreakdown,
    SkillType,
)


def run_layer6(result: AuditResult) -> AuditResult:
    s = result.scores
    bullets = result.doc.bullets

    # --- Impact (40 pts) ---
    s.action_verbs = _score_action_verbs(bullets)
    s.specificity = _score_specificity(bullets)
    s.quantification = _score_quantification(bullets)
    s.avoided_words = _score_avoided_words(result)
    s.impact_total = min(40, s.action_verbs + s.specificity + s.quantification + s.avoided_words)

    # --- Presentation (30 pts) ---
    s.length_format = _score_length(result)
    s.sections = _score_sections(result)
    s.consistency = _score_consistency(result)
    s.completeness = _score_completeness(result)
    s.spelling_grammar = _score_spelling(result)
    s.presentation_total = min(30, s.length_format + s.sections + s.consistency + s.completeness + s.spelling_grammar)

    # --- Competencies (30 pts) ---
    s.analytical = _score_competency(result, ANALYTICAL_VERBS, ANALYTICAL_OUTPUTS, ANALYTICAL_TOOLS)
    s.communication = _score_competency(result, COMMUNICATION_VERBS, COMMUNICATION_OUTPUTS, set())
    s.leadership = _score_competency(result, LEADERSHIP_VERBS, set(), LEADERSHIP_CONTEXTS)
    s.teamwork = _score_competency_relaxed(result, TEAMWORK_VERBS, TEAMWORK_CONTEXTS)
    s.initiative = _score_competency_relaxed(result, INITIATIVE_VERBS, INITIATIVE_SIGNALS)
    s.competencies_total = min(30, s.analytical + s.communication + s.leadership + s.teamwork + s.initiative)

    s.cv_quality_total = s.impact_total + s.presentation_total + s.competencies_total

    # --- JD Match (100 pts) ---
    if result.jd_keywords:
        s.exact_match = _score_jd_exact(result)
        s.semantic_match = _score_jd_semantic(result)
        s.experience_match = _score_jd_experience(result)
        s.ats_formatting = _score_jd_ats(result)
        s.jd_match_total = max(0, s.exact_match + s.semantic_match + s.experience_match + s.ats_formatting)
        s.jd_match_total = min(100, s.jd_match_total)

    _build_bullet_results(result)

    return result


# ===========================================================================
# Impact scoring
# ===========================================================================

def _score_action_verbs(bullets: list[Bullet]) -> int:
    if not bullets:
        return 0
    n = len(bullets)
    p = sum(
        1 for b in bullets
        if b.text.split()[0].lower().rstrip("ed,s,ing") in APPROVED_STRONG_VERBS
        or b.text.split()[0].lower() in APPROVED_STRONG_VERBS
    )
    ratio = p / n if n > 0 else 0
    if ratio >= 0.90:
        return 10
    if ratio >= 0.80:
        return 8
    if ratio >= 0.70:
        return 6
    if ratio >= 0.60:
        return 4
    return 2


def _score_specificity(bullets: list[Bullet]) -> int:
    if not bullets:
        return 0
    n = len(bullets)
    s = sum(1 for b in bullets if b.specificity_score >= 1.0)
    ratio = s / n if n > 0 else 0
    if ratio >= 0.90:
        return 15
    if ratio >= 0.80:
        return 12
    if ratio >= 0.70:
        return 9
    if ratio >= 0.60:
        return 6
    return 3


def _score_quantification(bullets: list[Bullet]) -> int:
    if not bullets:
        return 0
    n = len(bullets)
    q = sum(1 for b in bullets if re.search(r'\d+', b.text))
    ratio = q / n if n > 0 else 0
    if ratio >= 0.50:
        return 10
    if ratio >= 0.35:
        return 7
    if ratio >= 0.20:
        return 4
    return 1


def _score_avoided_words(result: AuditResult) -> int:
    score = 5
    full_text_lower = result.doc.raw_text.lower()
    for filler in FLAGGED_FILLER_WORDS:
        if filler in full_text_lower:
            score -= 1
    return max(0, score)


# ===========================================================================
# Presentation scoring
# ===========================================================================

def _score_length(result: AuditResult) -> int:
    pages = result.doc.page_count
    if pages == 1:
        return 5
    if pages == 2:
        return 2
    return 0


def _score_sections(result: AuditResult) -> int:
    required = {"experience", "education", "skills"}
    found = {s.name for s in result.doc.sections}

    score = 0
    has_name = any(s.name == "header" for s in result.doc.sections)
    if has_name:
        score += 1
    if result.doc.contact.email:
        score += 1
    for sec in required:
        if sec in found:
            score += 1
    return min(5, score)


def _score_consistency(result: AuditResult) -> int:
    score = 0
    bullets = result.doc.bullets

    tense_ok = all(b.tense_correct for b in bullets)
    score += 4 if tense_ok else 0

    endings = set()
    for b in bullets:
        text = b.text.strip()
        if text.endswith("."):
            endings.add("period")
        else:
            endings.add("none")
    punct_consistent = len(endings) <= 1
    score += 3 if punct_consistent else 0

    caps_ok = all(b.text[0].isupper() for b in bullets if b.text)
    score += 3 if caps_ok else 0

    return min(10, score)


def _score_completeness(result: AuditResult) -> int:
    score = 0
    doc = result.doc

    edu_sections = [s for s in doc.sections if s.name == "education"]
    if edu_sections:
        text = edu_sections[0].raw_text
        has_year = bool(re.search(r'20\d{2}|19\d{2}', text))
        has_degree = bool(re.search(r'(?:BSc|BA|MSc|MA|MBA|PhD|BEng|MEng|Bachelor|Master|Doctor)', text, re.I))
        if has_year:
            score += 1
        if has_degree:
            score += 1

    exp_sections = [s for s in doc.sections if s.name == "experience"]
    if exp_sections:
        score += 1

    if doc.contact.has_linkedin:
        score += 1

    skills_sections = [s for s in doc.sections if s.name == "skills"]
    if skills_sections:
        score += 1

    return min(5, score)


def _score_spelling(result: AuditResult) -> int:
    spell_errors = sum(1 for e in result.errors if "misspelling" in e.lower())
    if spell_errors == 0:
        return 5
    if spell_errors == 1:
        return 4
    if spell_errors == 2:
        return 3
    if spell_errors == 3:
        return 2
    return 0


# ===========================================================================
# Competency scoring
# ===========================================================================

def _score_competency(
    result: AuditResult,
    verbs: set[str],
    outputs: set[str],
    tools: set[str],
) -> int:
    count = 0
    for bullet in result.doc.bullets:
        text_lower = bullet.text.lower()
        words = set(text_lower.split())
        if words & verbs:
            count += 1
            continue
        if any(o in text_lower for o in outputs):
            count += 1
            continue
        if tools and (words & tools):
            count += 1
            continue

    if count >= 6:
        return 6
    if count >= 3:
        return 4
    if count >= 1:
        return 2
    return 0


def _score_competency_relaxed(
    result: AuditResult,
    verbs: set[str],
    contexts: set[str],
) -> int:
    count = 0
    for bullet in result.doc.bullets:
        text_lower = bullet.text.lower()
        words = set(text_lower.split())
        if words & verbs:
            count += 1
            continue
        if any(c in text_lower for c in contexts):
            count += 1
            continue

    if count >= 5:
        return 6
    if count >= 3:
        return 4
    if count >= 1:
        return 2
    return 0


# ===========================================================================
# JD Match scoring
# ===========================================================================

def _score_jd_exact(result: AuditResult) -> int:
    score = 0.0
    for kw in result.jd_keywords:
        if kw.status != KeywordStatus.FOUND:
            continue
        if kw.tier == KeywordTier.TIER_1:
            if "skills" in kw.found_in:
                score += 3.0
            elif "experience" in kw.found_in:
                score += 2.0
            elif "education" in kw.found_in:
                score += 1.2
            else:
                score += 2.0
        elif kw.tier == KeywordTier.TIER_2:
            score += 1.0
    return min(30, int(score))


def _score_jd_semantic(result: AuditResult) -> int:
    score = 0.0
    for kw in result.jd_keywords:
        if kw.status != KeywordStatus.SEMANTIC_ONLY:
            continue
        cs = kw.cosine_score
        if cs >= 0.65:
            score += 1.5
        elif cs >= 0.50:
            score += 0.8
        elif cs >= 0.38:
            score += 0.3
    return min(25, int(score))


def _score_jd_experience(result: AuditResult) -> int:
    return min(20, int(min(result.doc.total_experience_years * 3, 20)))


def _score_jd_ats(result: AuditResult) -> int:
    score = 25
    sa = result.structural

    if sa.has_multi_column:
        score -= 5
    if sa.has_hidden_text_boxes:
        score -= 3
    if sa.has_ghost_text:
        score -= 5
    if not sa.font_hierarchy_valid:
        score -= 2

    missing_t1 = [
        kw for kw in result.jd_keywords
        if kw.tier == KeywordTier.TIER_1 and kw.status == KeywordStatus.MISSING
    ]
    penalty = min(12, len(missing_t1) * 4)
    score -= penalty

    return max(0, score)


# ===========================================================================
# Bullet result summary for frontend
# ===========================================================================

def _build_bullet_results(result: AuditResult) -> None:
    for bullet in result.doc.bullets:
        severity = "Strong"
        if len(bullet.errors) >= 2:
            severity = "Revise"
        elif len(bullet.errors) == 1:
            severity = "Improve"

        result.bullet_results.append({
            "text": bullet.text,
            "role": bullet.role,
            "severity": severity,
            "is_achievement": bullet.is_achievement,
            "is_above_fold": bullet.is_above_fold,
            "tense_correct": bullet.tense_correct,
            "word_count": bullet.word_count,
            "errors": [
                {
                    "type": e.error_type,
                    "message": e.message,
                    "fix": e.fix_suggestion,
                }
                for e in bullet.errors
            ],
        })
