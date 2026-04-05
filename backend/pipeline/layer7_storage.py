"""
Layer 7: Storage & Diff Engine (SQLite)

7A. Schema: candidates, cv_versions, audit_results
7B. SHA-256 hashing for dedup / versioning
7C. Diff computation between versions
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

DB_PATH = Path("data") / "cvaudit.db"


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_role TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS cv_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            candidate_id INTEGER NOT NULL,
            version_number INTEGER NOT NULL DEFAULT 1,
            file_hash TEXT NOT NULL,
            filename TEXT,
            raw_text TEXT,
            upload_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        );

        CREATE TABLE IF NOT EXISTS audit_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cv_version_id INTEGER NOT NULL,
            jd_hash TEXT,
            jd_text TEXT,
            mode TEXT NOT NULL DEFAULT 'quality',
            target_role TEXT,
            cv_quality_total INTEGER DEFAULT 0,
            impact_score INTEGER DEFAULT 0,
            presentation_score INTEGER DEFAULT 0,
            competencies_score INTEGER DEFAULT 0,
            jd_match_total INTEGER DEFAULT 0,
            above_fold_score REAL DEFAULT 0,
            full_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (cv_version_id) REFERENCES cv_versions(id)
        );
    """)
    conn.commit()
    conn.close()


def compute_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def find_or_create_candidate(target_role: str) -> int:
    conn = _get_conn()
    row = conn.execute(
        "SELECT id FROM candidates WHERE target_role = ?", (target_role,)
    ).fetchone()
    if row:
        cid = row["id"]
    else:
        cur = conn.execute(
            "INSERT INTO candidates (target_role) VALUES (?)", (target_role,)
        )
        cid = cur.lastrowid
        conn.commit()
    conn.close()
    return cid


def save_cv_version(
    candidate_id: int,
    file_hash: str,
    filename: str,
    raw_text: str,
) -> int:
    conn = _get_conn()

    existing = conn.execute(
        "SELECT id FROM cv_versions WHERE file_hash = ? AND candidate_id = ?",
        (file_hash, candidate_id),
    ).fetchone()
    if existing:
        conn.close()
        return existing["id"]

    last_version = conn.execute(
        "SELECT MAX(version_number) as v FROM cv_versions WHERE candidate_id = ?",
        (candidate_id,),
    ).fetchone()
    next_version = (last_version["v"] or 0) + 1

    cur = conn.execute(
        """INSERT INTO cv_versions (candidate_id, version_number, file_hash, filename, raw_text)
           VALUES (?, ?, ?, ?, ?)""",
        (candidate_id, next_version, file_hash, filename, raw_text),
    )
    vid = cur.lastrowid
    conn.commit()
    conn.close()
    return vid


def save_audit_result(
    cv_version_id: int,
    result_json: dict,
    jd_text: str = "",
    mode: str = "quality",
    target_role: str = "",
) -> int:
    conn = _get_conn()
    jd_hash = compute_hash(jd_text.encode()) if jd_text else None
    scores = result_json.get("scores", {})

    cur = conn.execute(
        """INSERT INTO audit_results
           (cv_version_id, jd_hash, jd_text, mode, target_role,
            cv_quality_total, impact_score, presentation_score,
            competencies_score, jd_match_total, above_fold_score, full_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            cv_version_id,
            jd_hash,
            jd_text,
            mode,
            target_role,
            scores.get("cv_quality_total", 0),
            scores.get("cv_impact", 0),
            scores.get("cv_presentation", 0),
            scores.get("cv_competencies", 0),
            scores.get("jd_match_total", 0),
            result_json.get("metadata", {}).get("above_fold_score", 0),
            json.dumps(result_json),
        ),
    )
    aid = cur.lastrowid
    conn.commit()
    conn.close()
    return aid


def get_history(limit: int = 20) -> list[dict]:
    conn = _get_conn()
    rows = conn.execute(
        """SELECT
               ar.id,
               ar.created_at,
               ar.cv_quality_total,
               ar.jd_match_total,
               ar.impact_score,
               ar.presentation_score,
               ar.competencies_score,
               ar.mode,
               ar.target_role,
               cv.filename,
               cv.version_number,
               c.target_role as candidate_role
           FROM audit_results ar
           JOIN cv_versions cv ON ar.cv_version_id = cv.id
           JOIN candidates c ON cv.candidate_id = c.id
           ORDER BY ar.created_at DESC
           LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()

    return [
        {
            "id": r["id"],
            "created_at": r["created_at"],
            "cv_quality_total": r["cv_quality_total"],
            "jd_match_total": r["jd_match_total"],
            "impact_score": r["impact_score"],
            "presentation_score": r["presentation_score"],
            "competencies_score": r["competencies_score"],
            "mode": r["mode"],
            "target_role": r["target_role"] or r["candidate_role"],
            "filename": r["filename"],
            "version_number": r["version_number"],
        }
        for r in rows
    ]


def get_audit_detail(audit_id: int) -> Optional[dict]:
    conn = _get_conn()
    row = conn.execute(
        "SELECT full_json FROM audit_results WHERE id = ?", (audit_id,)
    ).fetchone()
    conn.close()
    if row and row["full_json"]:
        return json.loads(row["full_json"])
    return None


def get_diff(audit_id_a: int, audit_id_b: int) -> dict:
    """Compare two audit results and produce a diff summary."""
    a = get_audit_detail(audit_id_a)
    b = get_audit_detail(audit_id_b)

    if not a or not b:
        return {"error": "One or both audits not found."}

    sa = a.get("scores", {})
    sb = b.get("scores", {})

    diff = {
        "from_id": audit_id_a,
        "to_id": audit_id_b,
        "score_deltas": {},
        "fixed_errors": [],
        "new_errors": [],
    }

    for key in ("cv_quality_total", "cv_impact", "cv_presentation", "cv_competencies", "jd_match_total"):
        va = sa.get(key, 0)
        vb = sb.get(key, 0)
        diff["score_deltas"][key] = vb - va

    errors_a = set(a.get("errors", []))
    errors_b = set(b.get("errors", []))
    diff["fixed_errors"] = sorted(errors_a - errors_b)
    diff["new_errors"] = sorted(errors_b - errors_a)

    return diff


init_db()
