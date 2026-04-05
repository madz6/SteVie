# CV Auditor — Local-First CV Scoring System

Deterministic CV scoring. Temperature=0. Same CV = Same score, every time.

## Quick Start

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
streamlit run app.py
```

Opens at http://localhost:8501

## LLM Options

| Option | Quality | Cost | Setup |
|--------|---------|------|-------|
| Claude API | Best | ~$0.01/audit | Add API key in sidebar |
| Ollama Llama 3.1 70B | Excellent | Free | `ollama pull llama3.1:70b` (40GB) |
| Ollama Mistral 7B | Good | Free | `ollama pull mistral` (4GB) |

## Files

```
app.py                      # Streamlit UI
parser.py                   # PDF + DOCX parsing
scorer.py                   # Rule-based + LLM scoring
storage.py                  # SQLite history
prompts/
  MASTER_PROMPT_V3.md       # Standalone CV quality audit
  JD_MATCH_PROMPT.md        # Job description matching
data/
  cvaudit.db                # Auto-created SQLite database
```

## Scoring System

| Module | Max | What it measures |
|--------|-----|-----------------|
| Impact | 40 | Action verbs, specificity, quantification, avoided words |
| Presentation | 30 | Length, sections, dates, consistency, completeness, spelling |
| Competencies | 30 | Analytical thinking, communication, leadership, teamwork, initiative |
| **Total** | **100** | |

## Zones

- 🟢 86–100: Ready to send
- 🟡 65–85: Minor improvements needed
- 🟠 45–64: Revise before sending
- 🔴 0–44: Major revision needed
