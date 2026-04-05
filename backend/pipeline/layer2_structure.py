"""
Layer 2: Structural & Trajectory Engine

2A. Contact & Summary Strictness
    - Contact validation (email domain, LinkedIn, city/country)
    - Summary: < 4 lines, no first-person, must contain target job title
2B. Role Trajectory & Gaps
    - Seniority map normalisation + demotion detection
    - Education-to-first-job gap (flag > 180 days)
    - Bullet distribution rules per role duration
2C. Skills Section Structure
    - Flag flat lists, reward categorized
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from .constants import (
    SENIORITY_LEVELS,
    SKILL_CATEGORY_MARKERS,
    SECTION_KEYWORDS,
)
from .models import (
    AuditResult,
    BulletError,
    StructuralAnalysis,
)


def run_layer2(result: AuditResult) -> AuditResult:
    doc = result.doc
    sa = result.structural

    _check_contact(result)
    _check_summary(result)
    _check_seniority_progression(result)
    _check_education_gap(result)
    _check_bullet_distribution(result)
    _check_skills_structure(result)

    return result


# ---------------------------------------------------------------------------
# 2A  Contact & Summary
# ---------------------------------------------------------------------------

def _check_contact(result: AuditResult) -> None:
    contact = result.doc.contact
    if contact.email and not contact.email_professional:
        result.errors.append(
            f"Unprofessional email domain: {contact.email}. "
            "Use a gmail.com or custom domain address."
        )
    if not contact.has_linkedin:
        result.errors.append("LinkedIn URL missing — add your profile link.")
    if not contact.location:
        result.errors.append(
            "No city/country detected in header. Add location for recruiter context."
        )


def _check_summary(result: AuditResult) -> None:
    doc = result.doc
    if not doc.has_summary:
        return

    lines = [l.strip() for l in doc.summary_text.split("\n") if l.strip()]
    if len(lines) > 4:
        result.errors.append(
            f"Summary is {len(lines)} lines — should be 3-4 lines max."
        )

    first_person = re.findall(
        r'\b(I|me|my|myself)\b', doc.summary_text, re.I
    )
    if first_person:
        result.errors.append(
            "Summary contains first-person pronouns "
            f"({', '.join(set(p.lower() for p in first_person))}). "
            "Remove them — CVs should not use first person."
        )

    if result.target_role:
        if result.target_role.lower() not in doc.summary_text.lower():
            result.errors.append(
                f"Summary does not mention target role "
                f"'{result.target_role}'. Include it to pass ATS filtering."
            )


# ---------------------------------------------------------------------------
# 2B  Role Trajectory & Gaps
# ---------------------------------------------------------------------------

def _normalize_title(title: str) -> Optional[int]:
    title_lower = title.lower().strip()
    for level, keywords in sorted(SENIORITY_LEVELS.items(), reverse=True):
        for kw in keywords:
            if kw in title_lower:
                return level
    return None


def _check_seniority_progression(result: AuditResult) -> None:
    roles = result.doc.roles
    if len(roles) < 2:
        result.structural.career_progression_valid = True
        return

    levels = []
    for role in sorted(roles, key=lambda r: r.start_date or datetime.min):
        lvl = _normalize_title(role.title)
        role.seniority_level = lvl if lvl is not None else -1
        if lvl is not None:
            levels.append((role.title, lvl))

    for i in range(1, len(levels)):
        if levels[i][1] < levels[i - 1][1]:
            result.structural.career_progression_valid = False
            result.errors.append(
                f"Demotion detected: '{levels[i - 1][0]}' (L{levels[i - 1][1]}) "
                f"→ '{levels[i][0]}' (L{levels[i][1]}). "
                "Consider reframing the title or adding context."
            )
            return

    result.structural.career_progression_valid = True


def _check_education_gap(result: AuditResult) -> None:
    doc = result.doc
    edu_sections = [s for s in doc.sections if s.name == "education"]
    if not edu_sections or not doc.roles:
        return

    grad_date = _extract_graduation_date(edu_sections[0].raw_text)
    if not grad_date:
        return

    job_starts = [
        r.start_date for r in doc.roles if r.start_date
    ]
    if not job_starts:
        return

    first_job = min(job_starts)
    gap_days = (first_job - grad_date).days
    result.structural.education_experience_gap_days = max(0, gap_days)

    if gap_days > 180:
        result.errors.append(
            f"Gap of {gap_days // 30} months between graduation and first role. "
            "Consider adding relevant activities during this period."
        )


def _extract_graduation_date(edu_text: str) -> Optional[datetime]:
    year_matches = re.findall(r'20\d{2}|19\d{2}', edu_text)
    if year_matches:
        latest = max(int(y) for y in year_matches)
        return datetime(latest, 6, 1)
    return None


# ---------------------------------------------------------------------------
# Bullet distribution
# ---------------------------------------------------------------------------

def _check_bullet_distribution(result: AuditResult) -> None:
    roles = result.doc.roles
    if not roles:
        return

    for role in roles:
        n = len(role.bullets)
        months = role.duration_months

        if months > 12 and (n < 3 or n > 5):
            expected = "3-5"
            result.errors.append(
                f"{role.company} — {role.title}: {n} bullets for a "
                f"{months:.0f}-month role. Expected {expected}."
            )
        elif months < 6 and n > 2:
            result.errors.append(
                f"{role.company} — {role.title}: {n} bullets for a "
                f"{months:.0f}-month role. Expected 1-2."
            )

    sorted_roles = sorted(
        roles, key=lambda r: r.start_date or datetime.min, reverse=True
    )
    if len(sorted_roles) >= 2:
        newest = len(sorted_roles[0].bullets)
        for older in sorted_roles[1:]:
            if len(older.bullets) > newest and newest > 0:
                result.errors.append(
                    f"Most recent role ({sorted_roles[0].title}) has fewer bullets "
                    f"({newest}) than {older.title} ({len(older.bullets)}). "
                    "The most recent role should have equal or more bullets."
                )
                break


# ---------------------------------------------------------------------------
# 2C  Skills Section Structure
# ---------------------------------------------------------------------------

def _check_skills_structure(result: AuditResult) -> None:
    skills_sections = [
        s for s in result.doc.sections if s.name == "skills"
    ]
    if not skills_sections:
        return

    text = skills_sections[0].raw_text.lower()

    has_categories = any(marker in text for marker in SKILL_CATEGORY_MARKERS)
    result.structural.skills_categorized = has_categories

    if not has_categories:
        result.errors.append(
            "Skills section is a flat list. Categorize skills "
            "(e.g., 'Technical:', 'Methodologies:', 'Languages:') for ATS clarity."
        )
