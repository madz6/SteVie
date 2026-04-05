"""
FastAPI application — serves the audit API and static frontend.

Endpoints:
  GET  /                  → serves frontend/index.html
  POST /api/audit         → runs the full pipeline, streams SSE progress
  GET  /api/history       → returns audit history from SQLite
  GET  /api/audit/{id}    → returns a single audit result
  GET  /api/diff           → compares two audit results
"""
from __future__ import annotations

import asyncio
import json
import tempfile
import traceback
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sse_starlette.sse import EventSourceResponse
from fastapi.staticfiles import StaticFiles

from .pipeline import layer0_preflight as L0
from .pipeline import layer1_spatial as L1
from .pipeline import layer2_structure as L2
from .pipeline import layer3_linguistic as L3
from .pipeline import layer4_positional as L4
from .pipeline import layer5_semantic as L5
from .pipeline import layer6_scoring as L6
from .pipeline import layer7_storage as L7
from .pipeline.models import AuditResult

app = FastAPI(title="CV Audit System", version="1.0.0")

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@app.get("/")
async def serve_frontend():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


# ---------------------------------------------------------------------------
# POST /api/audit — full pipeline with SSE progress
# ---------------------------------------------------------------------------

LAYER_META = [
    {"name": "Layer 0 — Pre-flight", "desc": "Format routing · image PDF detection · date pre-calc"},
    {"name": "Layer 1 — Spatial", "desc": "BBox layout · font hierarchy · ATS traps · ghost text"},
    {"name": "Layer 2 — Structure", "desc": "Contact · trajectory · section order · seniority map"},
    {"name": "Layer 3 — Linguistic", "desc": "Achievement classification · tense · verb quality"},
    {"name": "Layer 4 — Positional", "desc": "Above-fold weighting · bullet distribution per role"},
    {"name": "Layer 5 — Semantic ATS", "desc": "JD keyword tiers · vector match · density scoring"},
    {"name": "Layer 6 — Scoring model", "desc": "Aggregating 100pt quality + 100pt JD match"},
    {"name": "Layer 7 — Storage", "desc": "SQLite versioning · diff computation"},
]


@app.post("/api/audit")
async def run_audit(
    cv_file: UploadFile = File(None),
    jd_file: UploadFile = File(None),
    jd_text: str = Form(""),
    target_role: str = Form(""),
    mode: str = Form("quality"),
):
    async def event_stream():
        try:
            # --- Read uploaded files ---
            if cv_file is None or cv_file.filename == "":
                yield {"event": "error", "data": json.dumps({"message": "CV file is required."})}
                return

            cv_bytes = await cv_file.read()
            suffix = Path(cv_file.filename).suffix.lower()

            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(cv_bytes)
                tmp_path = tmp.name

            # JD text: from file or pasted
            final_jd_text = jd_text
            if jd_file and jd_file.filename:
                jd_bytes = await jd_file.read()
                jd_suffix = Path(jd_file.filename).suffix.lower()
                with tempfile.NamedTemporaryFile(delete=False, suffix=jd_suffix) as jtmp:
                    jtmp.write(jd_bytes)
                    jtmp_path = jtmp.name
                try:
                    jd_parsed = L0.parse_file(jtmp_path)
                    final_jd_text = jd_parsed.raw_text
                except Exception:
                    final_jd_text = jd_bytes.decode("utf-8", errors="ignore")
                finally:
                    Path(jtmp_path).unlink(missing_ok=True)

            if mode == "jd_match" and not (final_jd_text or "").strip():
                yield {
                    "event": "error",
                    "data": json.dumps({
                        "message": "Full JD match requires a job description — paste text or upload a JD file.",
                    }),
                }
                return

            # --- Layer 0: Pre-flight ---
            yield {"event": "layer", "data": json.dumps({"index": 0, "status": "running", **LAYER_META[0]})}
            await asyncio.sleep(0.05)
            try:
                doc = L0.parse_file(tmp_path)
            except ValueError as e:
                yield {"event": "error", "data": json.dumps({"message": str(e)})}
                return
            finally:
                Path(tmp_path).unlink(missing_ok=True)

            result = AuditResult(doc=doc, mode=mode, target_role=target_role, jd_text=final_jd_text)
            yield {"event": "layer", "data": json.dumps({"index": 0, "status": "done", **LAYER_META[0]})}

            # --- Layer 1: Spatial ---
            yield {"event": "layer", "data": json.dumps({"index": 1, "status": "running", **LAYER_META[1]})}
            await asyncio.sleep(0.05)
            L1.run_layer1(result)
            yield {"event": "layer", "data": json.dumps({"index": 1, "status": "done", **LAYER_META[1]})}

            # --- Layer 2: Structure ---
            yield {"event": "layer", "data": json.dumps({"index": 2, "status": "running", **LAYER_META[2]})}
            await asyncio.sleep(0.05)
            L2.run_layer2(result)
            yield {"event": "layer", "data": json.dumps({"index": 2, "status": "done", **LAYER_META[2]})}

            # --- Layer 3: Linguistic ---
            yield {"event": "layer", "data": json.dumps({"index": 3, "status": "running", **LAYER_META[3]})}
            await asyncio.sleep(0.05)
            L3.run_layer3(result)
            yield {"event": "layer", "data": json.dumps({"index": 3, "status": "done", **LAYER_META[3]})}

            # --- Layer 4: Positional ---
            yield {"event": "layer", "data": json.dumps({"index": 4, "status": "running", **LAYER_META[4]})}
            await asyncio.sleep(0.05)
            L4.run_layer4(result)
            yield {"event": "layer", "data": json.dumps({"index": 4, "status": "done", **LAYER_META[4]})}

            # --- Layer 5: Semantic ---
            yield {"event": "layer", "data": json.dumps({"index": 5, "status": "running", **LAYER_META[5]})}
            await asyncio.sleep(0.05)
            if mode == "jd_match" and final_jd_text:
                L5.run_layer5(result)
            yield {"event": "layer", "data": json.dumps({"index": 5, "status": "done", **LAYER_META[5]})}

            # --- Layer 6: Scoring ---
            yield {"event": "layer", "data": json.dumps({"index": 6, "status": "running", **LAYER_META[6]})}
            await asyncio.sleep(0.05)
            L6.run_layer6(result)
            yield {"event": "layer", "data": json.dumps({"index": 6, "status": "done", **LAYER_META[6]})}

            # --- Layer 7: Storage ---
            yield {"event": "layer", "data": json.dumps({"index": 7, "status": "running", **LAYER_META[7]})}
            await asyncio.sleep(0.05)

            result_json = result.to_json()

            file_hash = L7.compute_hash(cv_bytes)
            candidate_id = L7.find_or_create_candidate(target_role or "general")
            cv_version_id = L7.save_cv_version(
                candidate_id, file_hash, cv_file.filename, doc.raw_text
            )
            audit_id = L7.save_audit_result(
                cv_version_id, result_json, final_jd_text, mode, target_role
            )
            result_json["audit_id"] = audit_id
            result_json["run_context"] = {
                "cv_filename": cv_file.filename or "",
                "run_at": datetime.now().isoformat(timespec="seconds"),
            }

            yield {"event": "layer", "data": json.dumps({"index": 7, "status": "done", **LAYER_META[7]})}

            # --- Final result ---
            yield {"event": "result", "data": json.dumps(result_json)}

        except Exception as e:
            yield {"event": "error", "data": json.dumps({
                "message": f"Pipeline error: {str(e)}",
                "traceback": traceback.format_exc(),
            })}

    return EventSourceResponse(event_stream())


# ---------------------------------------------------------------------------
# GET /api/history
# ---------------------------------------------------------------------------

@app.get("/api/history")
async def get_history(limit: int = 20):
    return JSONResponse(L7.get_history(limit))


# ---------------------------------------------------------------------------
# GET /api/audit/{id}
# ---------------------------------------------------------------------------

@app.get("/api/audit/{audit_id}")
async def get_audit(audit_id: int):
    detail = L7.get_audit_detail(audit_id)
    if detail is None:
        return JSONResponse({"error": "Audit not found"}, status_code=404)
    out = dict(detail)
    out["audit_id"] = audit_id
    return JSONResponse(out)


# ---------------------------------------------------------------------------
# GET /api/diff?a={id}&b={id}
# ---------------------------------------------------------------------------

@app.get("/api/diff")
async def get_diff(a: int, b: int):
    return JSONResponse(L7.get_diff(a, b))
