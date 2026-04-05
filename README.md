# CV Audit System

Deterministic 8-layer CV quality and JD match scoring. No cloud LLMs for scoring — uses local NLP (spaCy, sentence-transformers) and optional Ollama for JD keyword extraction.

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Mac/Linux

# 2. Install dependencies
pip install -r requirements.txt
python -m spacy download en_core_web_lg

# 3. (Optional) Install Ollama for JD keyword extraction
# Download from https://ollama.com then:
# ollama pull llama3:8b

# 4. Run (recommended on Windows — avoids port 8000 permission errors)
python run_server.py
# Or manually:
# uvicorn backend.api:app --reload --host 127.0.0.1 --port 8765
```

Open **http://127.0.0.1:8765** in your browser (or whatever port you set).

### Windows: `WinError 10013` or “forbidden by its access permissions” on port 8000

Windows often **excludes** port 8000 from user apps (Hyper-V, WSL, Docker Desktop, etc.). Use another port:

```powershell
python -m uvicorn backend.api:app --reload --host 127.0.0.1 --port 8765
```

Optional: list excluded TCP ranges (run **PowerShell as Administrator**):

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
```

Override port via env: `set PORT=9000` then `python run_server.py`.

## Architecture

```
8-Layer Deterministic Pipeline
  Layer 0: Pre-flight (format routing, date extraction, bullet parsing)
  Layer 1: Spatial (ATS traps, font hierarchy, whitespace, ghost text)
  Layer 2: Structure (contact, summary, seniority trajectory, bullet distribution)
  Layer 3: Linguistic (achievement classification, tense, verbs, cliches, spelling)
  Layer 4: Positional (above-fold weighting)
  Layer 5: Semantic ATS (JD extraction, keyword density, vector similarity)
  Layer 6: Scoring (100pt CV quality + 100pt JD match)
  Layer 7: Storage (SQLite versioning, diff computation)
```

## Scoring

**CV Quality (100 pts)**

| Module | Max | What it measures |
|--------|-----|-----------------|
| Impact | 40 | Action verbs, specificity, quantification, avoided words |
| Presentation | 30 | Length, sections, consistency, completeness, spelling |
| Competencies | 30 | Analytical, communication, leadership, teamwork, initiative |

**JD Match (100 pts)**

| Phase | Max | What it measures |
|-------|-----|-----------------|
| Exact Match | 30 | Tier 1/2 keywords found in CV |
| Semantic Match | 25 | Vector similarity for missing keywords |
| Experience Match | 20 | Years and seniority alignment |
| ATS/Formatting | 25 | Layout quality, penalties for issues |

## Stack

- **Backend:** FastAPI + uvicorn
- **Frontend:** Single HTML file (no build step)
- **NLP:** spaCy (en_core_web_lg), sentence-transformers (all-MiniLM-L6-v2)
- **Parsing:** PyMuPDF (PDF), python-docx (DOCX)
- **Spell check:** pyspellchecker + tech whitelist
- **JD extraction:** Ollama (llama3:8b) with regex fallback
- **Database:** SQLite (auto-created at data/cvaudit.db)
