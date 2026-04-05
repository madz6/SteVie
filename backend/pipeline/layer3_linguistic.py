"""
Layer 3: Linguistic & Impact Engine

3A. Achievement Classification & Plausibility
3B. Tense Consistency Check
3C. Duplicate Phrases & Verb Repetition
3D. Weak Words, Pronouns, Grammar, Readability, Spelling
"""
from __future__ import annotations

import re
from collections import Counter

import spacy

from .constants import (
    APPROVED_STRONG_VERBS,
    CLICHE_PHRASES,
    CONDITIONAL_VERBS,
    DIRECTIONAL_VERBS,
    FLAGGED_FILLER_WORDS,
    HEDGE_PHRASES,
    OUTCOME_NOUNS,
    PRONOUNS,
    TECH_WHITELIST,
    WEAK_STARTERS,
)
from .models import AuditResult, Bullet, BulletError

_nlp = None


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


def run_layer3(result: AuditResult) -> AuditResult:
    nlp = _get_nlp()

    for bullet in result.doc.bullets:
        doc_spacy = nlp(bullet.text)
        _classify_achievement(bullet, doc_spacy)
        _check_plausibility(bullet, result)
        _check_tense(bullet, doc_spacy)
        _check_weak_opener(bullet)
        _check_hedges(bullet)
        _check_pronouns_in_bullet(bullet)
        _check_passive_voice(bullet, doc_spacy)
        _check_readability(bullet)
        _check_filler_words(bullet)

    _check_verb_repetition(result)
    _check_cliche_phrases(result)
    _check_acronym_consistency(result)
    _run_spell_check(result)

    return result


# ---------------------------------------------------------------------------
# 3A  Achievement Classification & Plausibility
# ---------------------------------------------------------------------------

def _classify_achievement(bullet: Bullet, doc_spacy) -> None:
    text_lower = bullet.text.lower()

    has_directional = any(v in text_lower for v in DIRECTIONAL_VERBS)
    has_before_after = bool(re.search(r'from\s+\S+\s+to\s+\S+|by\s+\d+%', text_lower))
    has_outcome_noun = any(n in text_lower for n in OUTCOME_NOUNS)
    has_number = bool(re.search(r'\d+', bullet.text))

    if has_directional or has_before_after or (has_outcome_noun and has_number):
        bullet.is_achievement = True
    elif has_number and not has_directional:
        bullet.is_achievement = False
        bullet.errors.append(BulletError(
            error_type="Responsibility",
            message="Number present but no directional change — reads as a duty, not an achievement.",
            fix_suggestion="Add a directional verb (grew, reduced, improved) and an outcome.",
        ))
    else:
        bullet.is_achievement = False


def _check_plausibility(bullet: Bullet, result: AuditResult) -> None:
    text = bullet.text

    pct_match = re.findall(r'(\d+(?:,\d+)?)\s*%', text)
    for pct_str in pct_match:
        pct = float(pct_str.replace(",", ""))
        if pct > 500:
            bullet.errors.append(BulletError(
                error_type="Plausibility",
                message=f"{pct:.0f}% increase is implausibly high. Verify or provide context.",
            ))

    team_match = re.search(r'team\s+of\s+(\d+)', text, re.I)
    if team_match:
        team_size = int(team_match.group(1))
        is_junior = result.doc.career_stage.value == "Student"
        if is_junior and team_size > 50:
            bullet.errors.append(BulletError(
                error_type="Plausibility",
                message=f"Team of {team_size} is unusual for a junior role.",
            ))

    savings_match = re.search(r'(?:sav|reduc|cut)\w*\s+.*?(\d+)\s*%', text, re.I)
    if savings_match:
        savings = float(savings_match.group(1))
        if savings > 95:
            bullet.errors.append(BulletError(
                error_type="Plausibility",
                message=f"{savings:.0f}% saving/reduction is implausibly high.",
            ))


# ---------------------------------------------------------------------------
# 3B  Tense Consistency Check
# ---------------------------------------------------------------------------

def _check_tense(bullet: Bullet, doc_spacy) -> None:
    root_verbs = [t for t in doc_spacy if t.dep_ == "ROOT" and t.pos_ == "VERB"]
    if not root_verbs:
        return

    tag = root_verbs[0].tag_

    if bullet.is_current_role and tag == "VBD":
        bullet.tense_correct = False
        bullet.errors.append(BulletError(
            error_type="Tense",
            message="Current role bullet uses past tense. Use present tense for current position.",
            fix_suggestion=f"Change '{root_verbs[0].text}' to present tense.",
        ))
    elif not bullet.is_current_role and tag in ("VBZ", "VBP"):
        bullet.tense_correct = False
        bullet.errors.append(BulletError(
            error_type="Tense",
            message="Past role bullet uses present tense. Use past tense for previous positions.",
            fix_suggestion=f"Change '{root_verbs[0].text}' to past tense.",
        ))
    else:
        bullet.tense_correct = True


# ---------------------------------------------------------------------------
# 3C  Verb Repetition & Cliché Phrases
# ---------------------------------------------------------------------------

def _check_verb_repetition(result: AuditResult) -> None:
    role_verb_map: dict[str, Counter] = {}
    global_verb_counter: Counter = Counter()
    nlp = _get_nlp()

    for bullet in result.doc.bullets:
        doc_spacy = nlp(bullet.text)
        first_token = None
        for t in doc_spacy:
            if t.pos_ == "VERB":
                first_token = t
                break
        if first_token is None:
            continue

        lemma = first_token.lemma_.lower()
        global_verb_counter[lemma] += 1
        role_key = bullet.role
        if role_key not in role_verb_map:
            role_verb_map[role_key] = Counter()
        role_verb_map[role_key][lemma] += 1

    for role_key, counter in role_verb_map.items():
        for lemma, count in counter.items():
            if count > 2:
                for bullet in result.doc.bullets:
                    if bullet.role == role_key:
                        doc_spacy = nlp(bullet.text)
                        for t in doc_spacy:
                            if t.pos_ == "VERB" and t.lemma_.lower() == lemma:
                                bullet.errors.append(BulletError(
                                    error_type="Verb Repetition",
                                    message=f"'{lemma}' opens {count} bullets in this role. Vary your verbs.",
                                ))
                                break
                        break

    for lemma, count in global_verb_counter.items():
        if count > 3:
            for bullet in result.doc.bullets:
                doc_spacy = nlp(bullet.text)
                for t in doc_spacy:
                    if t.pos_ == "VERB" and t.lemma_.lower() == lemma:
                        already_flagged = any(
                            e.error_type == "Verb Repetition" for e in bullet.errors
                        )
                        if not already_flagged:
                            bullet.errors.append(BulletError(
                                error_type="Verb Repetition",
                                message=f"'{lemma}' used {count} times globally across the CV.",
                            ))
                        break
                break


def _check_cliche_phrases(result: AuditResult) -> None:
    for bullet in result.doc.bullets:
        text_lower = bullet.text.lower()
        for phrase in CLICHE_PHRASES:
            if phrase in text_lower:
                bullet.errors.append(BulletError(
                    error_type="Cliché",
                    message=f'"{phrase}" is generic filler. Replace with a specific outcome.',
                ))


# ---------------------------------------------------------------------------
# 3D  Weak Words, Pronouns, Grammar
# ---------------------------------------------------------------------------

def _check_weak_opener(bullet: Bullet) -> None:
    text_lower = bullet.text.lower().strip()
    for weak in WEAK_STARTERS:
        if text_lower.startswith(weak):
            bullet.errors.append(BulletError(
                error_type="Weak Verb",
                message=f'Starts with "{weak}". Replace with a strong action verb.',
                fix_suggestion="Use a verb from the approved list (Led, Built, Designed, etc.).",
            ))
            return

    words = text_lower.split()
    if words and words[0][0].isupper() is False:
        first_word = words[0]
        if not any(first_word.startswith(v) for v in APPROVED_STRONG_VERBS):
            if first_word in ("i", "we", "my"):
                bullet.errors.append(BulletError(
                    error_type="Pronoun Opener",
                    message="Bullet starts with a pronoun. Start with an action verb.",
                ))


def _check_hedges(bullet: Bullet) -> None:
    text_lower = bullet.text.lower()
    for hedge in HEDGE_PHRASES:
        if hedge in text_lower:
            bullet.errors.append(BulletError(
                error_type="Hedge Phrase",
                message=f'Contains "{hedge}" — weakens the bullet. Remove or rephrase.',
            ))


def _check_pronouns_in_bullet(bullet: Bullet) -> None:
    words = set(re.findall(r'\b\w+\b', bullet.text.lower()))
    found = words & PRONOUNS
    if found:
        bullet.errors.append(BulletError(
            error_type="Pronoun",
            message=f"Contains personal pronouns ({', '.join(sorted(found))}). "
                    "CVs should not use first person.",
        ))


def _check_passive_voice(bullet: Bullet, doc_spacy) -> None:
    for token in doc_spacy:
        if token.dep_ == "nsubjpass":
            bullet.errors.append(BulletError(
                error_type="Passive Voice",
                message="Passive voice detected. Rewrite in active voice for stronger impact.",
            ))
            return


def _check_readability(bullet: Bullet) -> None:
    wc = bullet.word_count
    if wc < 8:
        bullet.errors.append(BulletError(
            error_type="Too Short",
            message=f"Only {wc} words — lacks context. Expand with scope or outcome.",
        ))
    elif wc > 30:
        bullet.errors.append(BulletError(
            error_type="Run-on",
            message=f"{wc} words — too long. Split into two bullets or trim.",
        ))


def _check_filler_words(bullet: Bullet) -> None:
    text_lower = bullet.text.lower()
    for filler in FLAGGED_FILLER_WORDS:
        if filler in text_lower:
            bullet.errors.append(BulletError(
                error_type="Filler Word",
                message=f'Contains "{filler}" — remove or replace with evidence.',
            ))


# ---------------------------------------------------------------------------
# Acronym consistency
# ---------------------------------------------------------------------------

def _check_acronym_consistency(result: AuditResult) -> None:
    full_text = result.doc.raw_text
    acronyms = set(re.findall(r'\b[A-Z]{2,}\b', full_text))

    acronym_expansions = {
        "AI": "artificial intelligence",
        "ML": "machine learning",
        "NLP": "natural language processing",
        "API": "application programming interface",
        "SQL": "structured query language",
        "AWS": "amazon web services",
        "GCP": "google cloud platform",
        "CI": "continuous integration",
        "CD": "continuous deployment",
        "UI": "user interface",
        "UX": "user experience",
    }

    text_lower = full_text.lower()
    for acr in acronyms:
        expansion = acronym_expansions.get(acr)
        if expansion and expansion in text_lower:
            result.errors.append(
                f"Both '{acr}' and '{expansion}' appear. "
                "Standardize to one form to avoid ATS keyword fragmentation."
            )


# ---------------------------------------------------------------------------
# Spell check
# ---------------------------------------------------------------------------

def _run_spell_check(result: AuditResult) -> None:
    try:
        from spellchecker import SpellChecker
    except ImportError:
        return

    spell = SpellChecker()
    spell.word_frequency.load_words(list(TECH_WHITELIST))

    words = re.findall(r'\b[a-zA-Z]{2,}\b', result.doc.raw_text)
    words_lower = [w.lower() for w in words if not w.isupper()]

    misspelled = spell.unknown(words_lower)
    misspelled = {
        w for w in misspelled
        if w not in TECH_WHITELIST
        and len(w) > 2
        and not w[0].isupper()
    }

    for word in sorted(misspelled)[:10]:
        correction = spell.correction(word)
        if correction and correction != word:
            result.errors.append(
                f"Possible misspelling: '{word}' — did you mean '{correction}'?"
            )
