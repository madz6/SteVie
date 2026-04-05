"""
Layer 5: Semantic ATS Matching (JD Engine)

5A. LLM JD Extraction (Ollama at temperature=0, regex fallback)
5B. Density & Soft/Hard Skill Differentiation
    - Lemmatized keyword matching with spaCy PhraseMatcher
    - Hard skills: presence + density (0.5%-2.0%)
    - Soft skills: only if demonstrated in achievement bullets
    - Negation context anti-cheat
5C. Vector Semantic Match (sentence-transformers all-MiniLM-L6-v2)
5D. Experience math (interval merging in Layer 0, referenced here)
"""
from __future__ import annotations

import json
import re
from typing import Optional

import spacy
from spacy.matcher import PhraseMatcher

from .constants import OLLAMA_JD_PROMPT, TIER_SIGNAL_PATTERNS
from .models import (
    AuditResult,
    JDKeyword,
    KeywordStatus,
    KeywordTier,
    SkillType,
)

_nlp = None
_embedder = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            _nlp = spacy.load("en_core_web_lg")
        except OSError:
            try:
                _nlp = spacy.load("en_core_web_sm")
            except OSError:
                _nlp = spacy.blank("en")
    return _nlp


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _embedder = None
    return _embedder


def run_layer5(result: AuditResult) -> AuditResult:
    if not result.jd_text:
        return result

    keywords = _extract_jd_keywords(result.jd_text)
    if not keywords:
        return result

    nlp = _get_nlp()
    cv_text = result.doc.raw_text
    cv_lemmas = _lemmatize_text(cv_text, nlp)
    total_lemmas = len(cv_lemmas) if cv_lemmas else 1

    for kw in keywords:
        _match_keyword(kw, cv_text, cv_lemmas, total_lemmas, result, nlp)

    _run_vector_matching(keywords, result)
    _generate_quick_wins(keywords, result)

    result.jd_keywords = keywords
    return result


# ---------------------------------------------------------------------------
# 5A  JD Keyword Extraction
# ---------------------------------------------------------------------------

def _extract_jd_keywords(jd_text: str) -> list[JDKeyword]:
    keywords = _extract_via_ollama(jd_text)
    if not keywords:
        keywords = _extract_via_regex(jd_text)
    return keywords


def _extract_via_ollama(jd_text: str) -> list[JDKeyword]:
    try:
        import ollama
        prompt = OLLAMA_JD_PROMPT.replace("{jd_text}", jd_text)
        response = ollama.chat(
            model="llama3:8b",
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0, "seed": 42},
        )
        raw = response["message"]["content"]
        json_match = re.search(r'\{[\s\S]*\}', raw)
        if not json_match:
            return []
        data = json.loads(json_match.group())
        keywords = []
        for tier_key, tier_enum in [("tier_1", KeywordTier.TIER_1), ("tier_2", KeywordTier.TIER_2)]:
            for item in data.get(tier_key, []):
                kw_text = item.get("keyword", "").strip()
                if not kw_text:
                    continue
                skill_type = (
                    SkillType.SOFT
                    if item.get("type", "").lower() == "soft_skill"
                    else SkillType.HARD
                )
                keywords.append(JDKeyword(
                    keyword=kw_text,
                    tier=tier_enum,
                    skill_type=skill_type,
                ))
        return keywords
    except Exception:
        return []


def _extract_via_regex(jd_text: str) -> list[JDKeyword]:
    """Fallback: regex-based tier extraction when Ollama is unavailable."""
    keywords: list[JDKeyword] = []
    lines = jd_text.split("\n")

    current_tier = KeywordTier.TIER_2
    for line in lines:
        line_lower = line.lower().strip()
        for tier_key, signals in TIER_SIGNAL_PATTERNS.items():
            if any(s in line_lower for s in signals):
                current_tier = KeywordTier[tier_key.upper()]
                break

    nouns = _extract_noun_phrases(jd_text)
    for phrase in nouns:
        if len(phrase) < 2 or phrase.lower() in {"the", "a", "an", "we", "you", "our"}:
            continue
        keywords.append(JDKeyword(
            keyword=phrase,
            tier=KeywordTier.TIER_2,
            skill_type=SkillType.HARD,
        ))

    seen = set()
    deduped = []
    for kw in keywords:
        k = kw.keyword.lower()
        if k not in seen:
            seen.add(k)
            deduped.append(kw)

    return deduped[:30]


def _extract_noun_phrases(text: str) -> list[str]:
    nlp = _get_nlp()
    doc = nlp(text)
    phrases = set()
    for chunk in doc.noun_chunks:
        clean = chunk.text.strip()
        if 2 <= len(clean.split()) <= 4:
            phrases.add(clean)
    for ent in doc.ents:
        if ent.label_ in ("ORG", "PRODUCT", "GPE", "WORK_OF_ART"):
            phrases.add(ent.text.strip())
    return list(phrases)


# ---------------------------------------------------------------------------
# 5B  Keyword Matching
# ---------------------------------------------------------------------------

def _lemmatize_text(text: str, nlp) -> list[str]:
    doc = nlp(text.lower())
    return [token.lemma_ for token in doc if not token.is_punct and not token.is_space]


def _match_keyword(
    kw: JDKeyword,
    cv_text: str,
    cv_lemmas: list[str],
    total_lemmas: int,
    result: AuditResult,
    nlp,
) -> None:
    cv_lower = cv_text.lower()
    kw_lower = kw.keyword.lower()

    if kw_lower in cv_lower:
        if _is_negated(kw_lower, cv_text, nlp):
            kw.status = KeywordStatus.NEGATED
            return

        kw.status = KeywordStatus.FOUND
        kw.found_in = _find_sections(kw_lower, result)

        kw_lemma = " ".join(t.lemma_ for t in nlp(kw_lower))
        lemma_str = " ".join(cv_lemmas)
        count = lemma_str.count(kw_lemma)
        kw.density = count / total_lemmas if total_lemmas > 0 else 0

        if kw.skill_type == SkillType.SOFT:
            kw.demonstrated_in_bullet = _check_soft_skill_demonstrated(
                kw_lower, result
            )
    else:
        try:
            matcher = PhraseMatcher(nlp.vocab, attr="LEMMA")
            patterns = [nlp.make_doc(kw_lower)]
            matcher.add("KW", patterns)
            doc = nlp(cv_lower)
            matches = matcher(doc)
            if matches:
                kw.status = KeywordStatus.FOUND
                kw.found_in = ["lemma match"]
                return
        except Exception:
            pass

        kw.status = KeywordStatus.MISSING


def _is_negated(keyword: str, text: str, nlp) -> bool:
    """Check if keyword appears in a negation context."""
    sentences = text.split(".")
    for sent in sentences:
        if keyword.lower() not in sent.lower():
            continue
        doc = nlp(sent)
        for token in doc:
            if token.lemma_.lower() in keyword.lower().split():
                for ancestor in token.ancestors:
                    for child in ancestor.children:
                        if child.dep_ == "neg":
                            return True
    return False


def _find_sections(keyword: str, result: AuditResult) -> list[str]:
    found_in = []
    for section in result.doc.sections:
        if keyword in section.raw_text.lower():
            found_in.append(section.name)
    return found_in if found_in else ["text"]


def _check_soft_skill_demonstrated(keyword: str, result: AuditResult) -> bool:
    """Soft skills only score if demonstrated in an achievement bullet."""
    for bullet in result.doc.bullets:
        if keyword in bullet.text.lower() and bullet.is_achievement:
            return True
    return False


# ---------------------------------------------------------------------------
# 5C  Vector Semantic Match
# ---------------------------------------------------------------------------

def _run_vector_matching(keywords: list[JDKeyword], result: AuditResult) -> None:
    missing_t1 = [
        kw for kw in keywords
        if kw.tier == KeywordTier.TIER_1 and kw.status == KeywordStatus.MISSING
    ]
    if not missing_t1:
        return

    embedder = _get_embedder()
    if embedder is None:
        return

    bullet_texts = [b.text for b in result.doc.bullets if b.text.strip()]
    if not bullet_texts:
        return

    try:
        kw_texts = [kw.keyword for kw in missing_t1]
        kw_embeddings = embedder.encode(kw_texts, convert_to_tensor=True)
        bullet_embeddings = embedder.encode(bullet_texts, convert_to_tensor=True)

        from sentence_transformers import util
        cos_scores = util.cos_sim(kw_embeddings, bullet_embeddings)

        for i, kw in enumerate(missing_t1):
            max_score = float(cos_scores[i].max())
            kw.cosine_score = max_score

            if max_score >= 0.65:
                kw.status = KeywordStatus.SEMANTIC_ONLY
            elif max_score >= 0.50:
                kw.status = KeywordStatus.SEMANTIC_ONLY
            elif max_score >= 0.38:
                kw.status = KeywordStatus.SEMANTIC_ONLY
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Quick Wins
# ---------------------------------------------------------------------------

def _generate_quick_wins(keywords: list[JDKeyword], result: AuditResult) -> None:
    wins = []

    missing_t1 = [
        kw for kw in keywords
        if kw.tier == KeywordTier.TIER_1 and kw.status in (KeywordStatus.MISSING, KeywordStatus.SEMANTIC_ONLY)
    ]
    for kw in missing_t1[:3]:
        pts = 4 if kw.status == KeywordStatus.MISSING else 2
        wins.append({
            "action": f'Add "{kw.keyword}" to a work experience bullet with context',
            "points": pts,
            "keyword": kw.keyword,
        })

    low_density = [
        kw for kw in keywords
        if kw.status == KeywordStatus.FOUND and kw.density < 0.005
    ]
    for kw in low_density[:2]:
        wins.append({
            "action": f'Increase "{kw.keyword}" density — currently {kw.density*100:.1f}%, target 0.5-2%',
            "points": 2,
            "keyword": kw.keyword,
        })

    listed_only = [
        kw for kw in keywords
        if kw.status == KeywordStatus.FOUND
        and kw.found_in == ["skills"]
        and kw.skill_type == SkillType.HARD
    ]
    for kw in listed_only[:2]:
        wins.append({
            "action": f'Move "{kw.keyword}" from Skills into a work experience bullet',
            "points": 3,
            "keyword": kw.keyword,
        })

    wins.sort(key=lambda w: w["points"], reverse=True)
    result.quick_wins = wins[:5]
