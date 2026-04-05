from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class CareerStage(enum.Enum):
    STUDENT = "Student"
    MID = "Mid"
    SENIOR = "Senior"


class BulletSeverity(enum.Enum):
    STRONG = "Strong"
    IMPROVE = "Improve"
    REVISE = "Revise"


class SkillType(enum.Enum):
    HARD = "hard_skill"
    SOFT = "soft_skill"


class KeywordTier(enum.Enum):
    TIER_1 = "tier_1"
    TIER_2 = "tier_2"
    TIER_3 = "tier_3"


class KeywordStatus(enum.Enum):
    FOUND = "found"
    SEMANTIC_ONLY = "semantic_only"
    MISSING = "missing"
    NEGATED = "negated"


@dataclass
class Bullet:
    text: str
    role: str
    is_current_role: bool
    y_position: float = 0.0
    word_count: int = 0
    is_above_fold: bool = False
    is_achievement: bool = False
    tense_correct: bool = True
    specificity_score: float = 0.0
    errors: list[BulletError] = field(default_factory=list)

    def __post_init__(self):
        if self.word_count == 0:
            self.word_count = len(self.text.split())


@dataclass
class BulletError:
    error_type: str
    message: str
    fix_suggestion: str = ""


@dataclass
class Role:
    title: str
    company: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_current: bool = False
    bullets: list[Bullet] = field(default_factory=list)
    seniority_level: int = -1
    duration_months: float = 0.0

    @property
    def normalized_title(self) -> str:
        return self.title.lower().strip()


@dataclass
class Section:
    name: str
    raw_text: str
    y_position: float = 0.0
    roles: list[Role] = field(default_factory=list)


@dataclass
class ContactInfo:
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    location: Optional[str] = None
    email_professional: bool = True
    has_linkedin: bool = False


@dataclass
class FontInfo:
    size: float
    name: str
    is_bold: bool = False
    color: int = 0


@dataclass
class SpatialBlock:
    text: str
    bbox: tuple[float, float, float, float] = (0, 0, 0, 0)
    font: Optional[FontInfo] = None
    page_num: int = 0


@dataclass
class ParsedDocument:
    raw_text: str
    sections: list[Section] = field(default_factory=list)
    roles: list[Role] = field(default_factory=list)
    bullets: list[Bullet] = field(default_factory=list)
    spatial_blocks: list[SpatialBlock] = field(default_factory=list)
    contact: ContactInfo = field(default_factory=ContactInfo)
    word_count: int = 0
    page_count: int = 1
    page_height: float = 842.0
    page_width: float = 595.0
    file_type: str = "pdf"
    total_experience_years: float = 0.0
    career_stage: CareerStage = CareerStage.STUDENT
    has_summary: bool = False
    summary_text: str = ""


@dataclass
class JDKeyword:
    keyword: str
    tier: KeywordTier
    skill_type: SkillType
    status: KeywordStatus = KeywordStatus.MISSING
    density: float = 0.0
    found_in: list[str] = field(default_factory=list)
    cosine_score: float = 0.0
    demonstrated_in_bullet: bool = False


@dataclass
class StructuralAnalysis:
    has_multi_column: bool = False
    has_hidden_text_boxes: bool = False
    has_header_footer_text: bool = False
    has_ghost_text: bool = False
    font_hierarchy_valid: bool = True
    whitespace_ratio: float = 0.0
    section_order_valid: bool = True
    detected_section_order: list[str] = field(default_factory=list)
    expected_section_order: list[str] = field(default_factory=list)
    career_progression_valid: bool = True
    education_experience_gap_days: int = 0
    skills_categorized: bool = False
    demonstrated_skills: list[str] = field(default_factory=list)
    listed_only_skills: list[str] = field(default_factory=list)


@dataclass
class ScoreBreakdown:
    # CV Quality (100 pts)
    action_verbs: int = 0          # /10
    specificity: int = 0           # /15
    quantification: int = 0        # /10
    avoided_words: int = 5         # /5 (starts at 5, deductions)
    impact_total: int = 0          # /40

    length_format: int = 0         # /5
    sections: int = 0              # /5
    consistency: int = 0           # /10
    completeness: int = 0          # /5
    spelling_grammar: int = 0      # /5
    presentation_total: int = 0    # /30

    analytical: int = 0            # /6
    communication: int = 0         # /6
    leadership: int = 0            # /6
    teamwork: int = 0              # /6
    initiative: int = 0            # /6
    competencies_total: int = 0    # /30

    cv_quality_total: int = 0      # /100

    # JD Match (100 pts)
    exact_match: int = 0           # /30
    semantic_match: int = 0        # /25
    experience_match: int = 0      # /20
    ats_formatting: int = 25       # /25 (starts at 25, penalties)
    jd_match_total: int = 0        # /100

    above_fold_score: float = 0.0


@dataclass
class AuditResult:
    doc: ParsedDocument = field(default_factory=ParsedDocument)
    structural: StructuralAnalysis = field(default_factory=StructuralAnalysis)
    scores: ScoreBreakdown = field(default_factory=ScoreBreakdown)
    jd_keywords: list[JDKeyword] = field(default_factory=list)
    quick_wins: list[dict] = field(default_factory=list)
    bullet_results: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    mode: str = "quality"  # "quality" or "jd_match"
    target_role: str = ""
    jd_text: str = ""

    def _score_breakdown_dict(self) -> dict:
        sc = self.scores
        cv = {
            "impact": {
                "action_verbs": {"score": sc.action_verbs, "max": 10},
                "specificity": {"score": sc.specificity, "max": 15},
                "quantification": {"score": sc.quantification, "max": 10},
                "avoided_words": {"score": sc.avoided_words, "max": 5},
                "total": {"score": sc.impact_total, "max": 40},
            },
            "presentation": {
                "length_format": {"score": sc.length_format, "max": 5},
                "sections": {"score": sc.sections, "max": 5},
                "consistency": {"score": sc.consistency, "max": 10},
                "completeness": {"score": sc.completeness, "max": 5},
                "spelling_grammar": {"score": sc.spelling_grammar, "max": 5},
                "total": {"score": sc.presentation_total, "max": 30},
            },
            "competencies": {
                "analytical": {"score": sc.analytical, "max": 6},
                "communication": {"score": sc.communication, "max": 6},
                "leadership": {"score": sc.leadership, "max": 6},
                "teamwork": {"score": sc.teamwork, "max": 6},
                "initiative": {"score": sc.initiative, "max": 6},
                "total": {"score": sc.competencies_total, "max": 30},
            },
            "above_fold_score": round(sc.above_fold_score, 1),
        }
        jd = None
        if self.mode == "jd_match":
            jd = {
                "exact_match": {"score": sc.exact_match, "max": 30},
                "semantic_match": {"score": sc.semantic_match, "max": 25},
                "experience_match": {"score": sc.experience_match, "max": 20},
                "ats_formatting": {"score": sc.ats_formatting, "max": 25},
                "total": {"score": sc.jd_match_total, "max": 100},
            }
        return {"cv_quality": cv, "jd_match": jd}

    def executive_summary(self) -> list[str]:
        lines: list[str] = []
        sc = self.scores
        if sc.cv_quality_total >= 86:
            lines.append("CV quality is in a strong range — focus on role-specific tailoring if applying.")
        elif sc.cv_quality_total < 45:
            lines.append("CV quality needs substantial revision before wide application.")

        for err in self.errors[:3]:
            if err not in lines:
                lines.append(err)

        if self.structural.has_multi_column:
            lines.append("ATS risk: multi-column layout detected — parsers may misread order.")
        if self.structural.has_hidden_text_boxes:
            lines.append("DOCX text boxes detected — content may be invisible to some ATS tools.")

        revise = improve = 0
        for sec in self.doc.sections:
            for role in sec.roles:
                for b in role.bullets:
                    n = len(b.errors)
                    if n >= 2:
                        revise += 1
                    elif n == 1:
                        improve += 1
        if revise:
            lines.append(f"{revise} bullet(s) flagged for major revision — see Bullet review.")
        elif improve and not lines:
            lines.append(f"{improve} bullet(s) could be strengthened with clearer outcomes.")

        if self.mode == "jd_match" and self.jd_keywords:
            missing_t1 = sum(
                1 for kw in self.jd_keywords
                if kw.tier == KeywordTier.TIER_1 and kw.status == KeywordStatus.MISSING
            )
            if missing_t1:
                lines.append(
                    f"{missing_t1} Tier-1 JD requirement(s) missing — check JD match tab."
                )

        if not lines:
            lines.append("No critical blockers flagged — review tabs for fine-grained feedback.")

        return lines[:5]

    def to_json(self) -> dict:
        return {
            "metadata": {
                "estimated_pages": self.doc.page_count,
                "whitespace_ratio": round(self.structural.whitespace_ratio, 2),
                "total_word_count": self.doc.word_count,
                "above_fold_score": round(self.scores.above_fold_score, 1),
                "career_stage": self.doc.career_stage.value,
                "total_experience_years": round(self.doc.total_experience_years, 1),
            },
            "score_breakdown": self._score_breakdown_dict(),
            "executive_summary": self.executive_summary(),
            "scores": {
                "cv_quality_total": self.scores.cv_quality_total,
                "cv_impact": self.scores.impact_total,
                "cv_presentation": self.scores.presentation_total,
                "cv_competencies": self.scores.competencies_total,
                "jd_match_total": self.scores.jd_match_total,
            },
            "structural_analysis": {
                "has_multi_column_error": self.structural.has_multi_column,
                "has_hidden_text_boxes": self.structural.has_hidden_text_boxes,
                "font_hierarchy_valid": self.structural.font_hierarchy_valid,
                "section_order_valid": self.structural.section_order_valid,
                "career_progression_valid": self.structural.career_progression_valid,
                "education_experience_gap_days": self.structural.education_experience_gap_days,
                "skills_categorized": self.structural.skills_categorized,
                "demonstrated_skills": self.structural.demonstrated_skills,
                "listed_only_skills": self.structural.listed_only_skills,
                "whitespace_ratio": round(self.structural.whitespace_ratio, 2),
                "has_ghost_text": self.structural.has_ghost_text,
            },
            "sections": self._sections_json(),
            "jd_match": {
                "keyword_analysis": [
                    {
                        "keyword": kw.keyword,
                        "tier": kw.tier.value,
                        "type": kw.skill_type.value,
                        "density": round(kw.density, 4),
                        "status": self._keyword_status_label(kw),
                        "cosine_score": round(kw.cosine_score, 2) if kw.cosine_score else None,
                    }
                    for kw in self.jd_keywords
                ],
                "quick_wins": self.quick_wins,
            },
            "errors": self.errors,
            "mode": self.mode,
            "target_role": self.target_role,
        }

    def _sections_json(self) -> list[dict]:
        out = []
        for section in self.doc.sections:
            s = {
                "section_name": section.name,
                "roles": [],
            }
            for role in section.roles:
                r = {
                    "title": role.title,
                    "company": role.company,
                    "is_current_role": role.is_current,
                    "bullet_count": len(role.bullets),
                    "bullets": [],
                }
                for b in role.bullets:
                    r["bullets"].append({
                        "original_text": b.text,
                        "word_count": b.word_count,
                        "is_above_fold": b.is_above_fold,
                        "is_achievement": b.is_achievement,
                        "tense_correct": b.tense_correct,
                        "errors": [
                            {"type": e.error_type, "message": e.message, "fix": e.fix_suggestion}
                            for e in b.errors
                        ],
                    })
                s["roles"].append(r)
            out.append(s)
        return out

    @staticmethod
    def _keyword_status_label(kw: JDKeyword) -> str:
        if kw.status == KeywordStatus.FOUND:
            if kw.demonstrated_in_bullet:
                return "Demonstrated in bullets"
            return f"Found ({', '.join(kw.found_in)})"
        if kw.status == KeywordStatus.SEMANTIC_ONLY:
            return f"Semantic only (cosine {kw.cosine_score:.2f})"
        if kw.status == KeywordStatus.NEGATED:
            return "Found in negation context"
        return "Not found"
