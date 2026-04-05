APPROVED_STRONG_VERBS = {
    "led", "managed", "designed", "built", "developed", "delivered",
    "identified", "conducted", "produced", "authored", "analysed", "analyzed",
    "created", "defined", "established", "generated", "implemented",
    "launched", "negotiated", "presented", "reduced", "increased",
    "achieved", "directed", "drove", "executed", "formulated", "initiated",
    "optimised", "optimized", "oversaw", "resolved", "structured",
    "transformed", "deployed", "engineered", "evaluated", "mapped",
    "modelled", "modeled", "owned", "researched", "secured", "streamlined",
    "acted", "assumed", "pitched", "proposed", "redesigned", "consolidated",
    "automated", "standardised", "standardized", "coordinated",
    "spearheaded", "championed", "cultivated", "pioneered",
}

CONDITIONAL_VERBS = {
    "facilitated", "collaborated", "partnered", "contributed",
}

WEAK_STARTERS = [
    "responsible for", "responsibilities included", "worked on",
    "worked with", "helped", "assisted", "supported",
    "participated in", "involved in", "was responsible for",
    "was tasked with", "contributed to",
]

ADVERB_OPENERS = [
    "successfully", "effectively", "independently", "proactively",
    "efficiently", "seamlessly",
]

FLAGGED_FILLER_WORDS = [
    "successfully", "effectively", "efficiently", "proactively",
    "seamlessly", "various", "passionate about", "enthusiasm for",
    "excellent", "dynamic", "results-driven", "detail-oriented",
    "hardworking", "motivated",
]

CLICHE_PHRASES = [
    "cross-functional teams",
    "fast-paced environment",
    "attention to detail",
    "team player",
    "stakeholder management",
    "drive results",
    "best practices",
    "go-to person",
    "liaise with",
]

HEDGE_PHRASES = [
    "helped to", "involved in", "responsible for",
    "responsible for managing", "tried to", "worked to",
    "attempted to", "contributed to the success of",
]

PRONOUNS = {"i", "me", "my", "we", "our"}

PRESENT_STRINGS = {"present", "current", "now", "today", "-", "\u2013", ""}

UNPROFESSIONAL_EMAIL_DOMAINS = {"hotmail", "aol", "yahoo", "ymail", "live"}

SENIORITY_LEVELS = {
    0: ["intern", "trainee", "placement", "graduate", "apprentice"],
    1: ["analyst", "associate", "assistant", "junior", "coordinator", "executive"],
    2: ["senior analyst", "lead analyst", "specialist", "consultant", "senior",
        "lead", "senior associate"],
    3: ["manager", "senior manager", "team lead", "principal", "senior consultant"],
    4: ["director", "head of", "vp", "vice president", "senior director"],
    5: ["cto", "ceo", "cpo", "coo", "cfo", "c-suite", "founder", "co-founder",
        "partner", "managing director"],
}

SECTION_KEYWORDS = {
    "experience": [
        "experience", "work experience", "employment", "work history",
        "professional experience", "career history",
    ],
    "education": [
        "education", "academic background", "qualifications",
        "academic qualifications", "academic",
    ],
    "skills": [
        "skills", "technical skills", "competencies", "core skills",
        "key skills", "tools", "technologies", "tools & technologies",
    ],
    "projects": [
        "projects", "personal projects", "selected projects", "key projects",
        "side projects",
    ],
    "summary": [
        "summary", "profile", "about", "objective", "personal statement",
        "professional summary", "career objective",
    ],
    "certifications": [
        "certifications", "certificates", "licenses", "accreditations",
    ],
    "languages": [
        "languages", "language skills",
    ],
    "interests": [
        "interests", "hobbies", "activities", "extracurricular",
    ],
}

EXPECTED_SECTION_ORDER = {
    "Student": ["education", "experience", "skills"],
    "Mid": ["experience", "education", "skills"],
    "Senior": ["experience", "skills", "education"],
}

SKILL_CATEGORY_MARKERS = [
    "technical", "methodologies", "tools", "languages", "frameworks",
    "platforms", "databases", "cloud", "soft skills", "certifications",
    "programming", "software", "design", "analytics", "management",
]

# Competency detection word lists
ANALYTICAL_VERBS = {
    "analysed", "analyzed", "evaluated", "assessed", "diagnosed",
    "modelled", "modeled", "forecast", "quantified", "profiled",
    "investigated", "synthesised", "synthesized", "tested", "mapped",
    "benchmarked", "segmented", "prioritised", "prioritized",
}
ANALYTICAL_OUTPUTS = {
    "financial model", "data model", "regression", "competitive analysis",
    "gap analysis", "requirements audit", "mece", "jtbd", "data profiling",
    "market sizing", "scenario analysis",
}
ANALYTICAL_TOOLS = {
    "python", "r", "sql", "tableau", "power bi", "excel", "matlab",
    "statistical", "spss", "stata",
}

COMMUNICATION_VERBS = {
    "presented", "delivered", "communicated", "authored", "wrote",
    "documented", "reported", "demonstrated", "pitched", "articulated",
    "published", "briefed",
}
COMMUNICATION_OUTPUTS = {
    "report", "presentation", "proposal", "stakeholder update",
    "client deliverable", "demo", "prd", "strategy document",
    "user story", "briefing", "deck", "memo", "whitepaper",
}

LEADERSHIP_VERBS = {
    "led", "managed", "directed", "oversaw", "coordinated", "chaired",
    "guided", "mentored", "elected", "founded", "co-founded", "owned",
    "spearheaded",
}
LEADERSHIP_CONTEXTS = {
    "team lead", "project lead", "product owner", "scrum master",
    "captain", "president", "sole", "founding team", "full ownership",
}

TEAMWORK_VERBS = {
    "collaborated", "partnered", "liaised", "bridged", "aligned",
}
TEAMWORK_CONTEXTS = {
    "cross-functional", "founding team", "multi-disciplinary",
    "engineering and design", "worked with",
}

INITIATIVE_VERBS = {
    "initiated", "founded", "co-founded", "proposed", "launched",
    "built", "pioneered", "established",
}
INITIATIVE_SIGNALS = {
    "from concept", "from scratch", "from zero", "no existing solution",
    "first of its kind", "self-directed", "co-founder", "side project",
    "independent project",
}

DIRECTIONAL_VERBS = {
    "grew", "reduced", "increased", "decreased", "cut", "improved",
    "saved", "eliminated", "scaled", "boosted", "accelerated",
    "expanded", "lowered", "raised", "doubled", "tripled", "halved",
    "minimized", "minimised", "maximized", "maximised",
}
OUTCOME_NOUNS = {
    "revenue", "cost", "latency", "time", "adoption", "retention",
    "conversion", "velocity", "efficiency", "throughput", "performance",
    "engagement", "satisfaction", "accuracy", "coverage", "savings",
    "growth", "productivity", "quality", "speed", "margin",
}

TECH_WHITELIST = {
    "agile", "scrum", "kanban", "saas", "paas", "iaas", "sql", "nosql",
    "api", "apis", "aws", "gcp", "azure", "ci", "cd", "devops", "mlops",
    "ai", "ml", "nlp", "llm", "llms", "gpu", "cpu", "sdk", "cli", "gui",
    "html", "css", "js", "jsx", "tsx", "ts", "csv", "json", "xml", "yaml",
    "yml", "http", "https", "rest", "grpc", "graphql", "oauth", "jwt",
    "jtbd", "okr", "okrs", "kpi", "kpis", "prd", "roi", "mvp", "poc",
    "b2b", "b2c", "saas", "crm", "erp", "ui", "ux", "figma", "miro",
    "jira", "confluence", "trello", "asana", "notion", "slack",
    "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins",
    "github", "gitlab", "bitbucket", "linux", "unix", "macos", "ios",
    "android", "react", "vue", "angular", "svelte", "nextjs", "nuxt",
    "django", "flask", "fastapi", "express", "nodejs", "deno", "bun",
    "pytorch", "tensorflow", "keras", "scikit", "pandas", "numpy",
    "scipy", "matplotlib", "seaborn", "plotly", "tableau", "looker",
    "snowflake", "redshift", "bigquery", "databricks", "airflow",
    "kafka", "rabbitmq", "redis", "mongodb", "postgresql", "mysql",
    "elasticsearch", "neo4j", "cassandra", "dynamodb", "firebase",
    "supabase", "vercel", "netlify", "heroku", "digitalocean",
    "opex", "capex", "ebitda", "cagr",
}

TIER_SIGNAL_PATTERNS = {
    "tier_1": [
        "must have", "required", "essential", "minimum requirement",
        "you must", "mandatory", "critical", "non-negotiable",
        "requirements:", "required qualifications",
    ],
    "tier_2": [
        "preferred", "ideally", "desired", "we'd love",
        "strongly preferred", "highly desirable",
    ],
    "tier_3": [
        "bonus", "plus", "advantageous", "not essential but",
        "nice to have", "a plus",
    ],
}

OLLAMA_JD_PROMPT = """You are a job description parser. Extract ALL keywords/skills from this job description and classify each.

Output ONLY valid JSON with this exact structure:
{
  "tier_1": [{"keyword": "...", "type": "hard_skill|soft_skill"}],
  "tier_2": [{"keyword": "...", "type": "hard_skill|soft_skill"}]
}

Rules:
- tier_1 = explicitly required ("must have", "required", "essential")
- tier_2 = preferred/desired ("preferred", "ideally", "nice to have", or mentioned without tier language)
- hard_skill = tool, language, framework, certification, methodology
- soft_skill = competency demonstrated through behaviour (leadership, communication, etc.)
- Extract the canonical short form of each skill (e.g. "Python" not "experience with Python programming")
- Do NOT include generic filler ("team player", "motivated") unless the JD emphasizes it

Job Description:
{jd_text}
"""
