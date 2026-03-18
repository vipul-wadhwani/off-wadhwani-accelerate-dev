# V2 — Panel Interview Insights Prompt

## Purpose

Generate a deep-dive AI-powered briefing for the interview panel evaluating ventures on the Wadhwani Accelerate platform. The venture has already been screened and assigned a program tier by the Screening Manager. This prompt helps panelists probe **gaps**, **revenue assumptions**, and **growth opportunity** before making the final accept/reject decision.

**Source:** `backend/src/services/aiService.ts` → `buildPanelInsightsPrompt()`

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 3,000 |
| **Temperature** | 0.3 |
| **API Endpoint** | `POST /api/ventures/:id/generate-insights?type=panel` |
| **Allowed Roles** | `success_mgr`, `venture_mgr`, `committee_member`, `admin` |
| **Estimated Cost** | ~$0.02-0.04 per generation |

---

## When Used

Triggered when a panel member clicks **"Generate Panel Insights"** before or during the interview stage. The venture has already been screened and assigned a tier by the Screening Manager. This prompt produces a deep-dive analysis to help the panel probe gaps, validate revenue claims, and evaluate the growth opportunity before making the final accept/reject decision.

---

## Input Data

The prompt is constructed from `VentureData` interface + VSM notes + panel notes + prior screening insights:

```typescript
interface VentureData {
    id: string;
    name: string;
    founder_name?: string;
    revenue_12m?: number;
    revenue_potential_3y?: number;
    full_time_employees?: number;
    growth_focus?: string;
    growth_current?: any;            // JSONB - current product/segment/geography
    growth_target?: any;             // JSONB - target product/segment/geography
    commitment?: any;                // JSONB
    vsm_notes?: string;
    panel_notes?: string;
    screening_recommendation?: string; // Tier assigned during V1 screening
    prior_ai_analysis?: object;        // V1 screening insights (if available)
    corporate_presentation_text?: string;  // Extracted from uploaded PDF/PPT
}
```

**Corporate Presentation:** If the venture has uploaded a corporate presentation, the text is extracted via `documentService.extractDocumentText()` and included in the prompt (truncated at **3,000 characters**).

**Prior Screening Insights:** The V1 screening insights (if previously generated) are passed into the prompt (truncated at **2,000 characters**) so the panel analysis can build on — rather than repeat — the initial screening.

---

## Prompt Template

```
You are a venture evaluation analyst preparing a panel interview briefing. Analyze the venture on three dimensions: Gaps (capability/execution gaps), Revenue (credibility of financial projections), and Growth Opportunity (market size and execution feasibility).

**Venture Information:**
- Company Name: ${ventureData.name}
- Founder: ${ventureData.founder_name || 'N/A'}
- Current Revenue (12M): ₹${ventureData.revenue_12m?.toLocaleString() || 'N/A'}
- Target Revenue (3Y): ₹${ventureData.revenue_potential_3y?.toLocaleString() || 'N/A'}
- Full-Time Employees: ${ventureData.full_time_employees || 'N/A'}
- Growth Focus: ${ventureData.growth_focus || 'N/A'}
- Current Market: ${JSON.stringify(ventureData.growth_current || {})}
- Target Market: ${JSON.stringify(ventureData.growth_target || {})}
- Screening Tier: ${ventureData.screening_recommendation || 'N/A'}

**Current Business:**
- Products/Services: ${ventureData.what_do_you_sell || 'N/A'}
- Customer Segments: ${ventureData.who_do_you_sell_to || 'N/A'}
- Regions: ${ventureData.which_regions || 'N/A'}

**New Growth Idea:**
- Growth Type: ${ventureData.growth_type || ventureData.growth_focus || 'N/A'}
- New Product/Service: ${ventureData.focus_product || 'N/A'}
- New Customer Segment: ${ventureData.focus_segment || 'N/A'}
- New Geography: ${ventureData.focus_geography || 'N/A'}
- Support Description: ${ventureData.support_description || 'N/A'}

**Screening Manager's Notes:**
${vsmNotes || 'No screening notes provided.'}

**Panel Member's Notes:**
${panelNotes || 'No panel notes provided.'}

**Corporate Presentation Content (summary):**
${ventureData.corporate_presentation_text?.slice(0, 3000) || 'No corporate presentation provided.'}

**Prior Screening Insights (if available):**
${JSON.stringify(ventureData.prior_ai_analysis || 'No prior AI insights available.').slice(0, 2000)}

Based on all available data, generate a concise panel briefing. Keep each field brief (1-2 sentences max). Return ONLY valid JSON, no markdown.

**Your Task:**
Provide a comprehensive panel interview briefing in the following JSON format:

{
  "panel_recommendation": "<One of: Accept, Accept with Conditions, Defer, or Reject>",
  "executive_summary": "<3-4 sentence summary>",
  "market_context": "<2-3 sentences on sector landscape>",
  "gap_deep_dive": {
    "critical_gaps": ["<Gap 1>", "<Gap 2>", "<Gap 3>"],
    "addressable_gaps": ["<Gap 1>", "<Gap 2>", "<Gap 3>"],
    "gap_summary": "<1-2 sentences>"
  },
  "revenue_deep_dive": {
    "current_health": "<1-2 sentences>",
    "projection_credibility": "<1-2 sentences>",
    "key_revenue_risks": ["<Risk 1>", "<Risk 2>", "<Risk 3>"],
    "revenue_summary": "<1-2 sentences>"
  },
  "growth_opportunity_deep_dive": {
    "market_size_signal": "<1-2 sentences>",
    "competitive_positioning": "<1-2 sentences>",
    "execution_feasibility": "<1-2 sentences>",
    "growth_summary": "<1-2 sentences>"
  },
  "strengths": ["<Strength 1>", "<Strength 2>", "<Strength 3>"],
  "risks": ["<Risk 1>", "<Risk 2>", "<Risk 3>"],
  "interview_questions": [
    {"question": "<Q1>", "intent": "<Intent>"},
    {"question": "<Q2>", "intent": "<Intent>"},
    {"question": "<Q3>", "intent": "<Intent>"}
  ]
}

Return ONLY the JSON object, no additional text.
```

---

## Output Format Guidelines

### Panel Recommendation

The panel recommendation reflects a final accept/reject decision, not a tier assignment (the tier was already decided during screening):

| Recommendation | Meaning |
|----------------|---------|
| **Accept** | Venture is ready to enter the assigned program tier. Strong fundamentals, credible growth plan, gaps are manageable. |
| **Accept with Conditions** | Venture is promising but has specific gaps or risks that must be addressed as conditions of entry. |
| **Defer** | Venture has potential but is not ready now. Recommend re-application in the next cohort. |
| **Reject** | Venture does not meet program standards. Fundamental issues that Accelerate cannot address. |

### Gap Deep Dive

**Critical Gaps (3 items):** Gaps severe enough to threaten success even with Accelerate's support.

**Addressable Gaps (3 items):** Gaps that Accelerate's mentorship, resources, and network can realistically help close.

**Gap Summary:** Overall assessment of gap severity and whether Accelerate can bridge them.

### Revenue Deep Dive

**Current Health:** Revenue quality — recurring vs. one-time, customer concentration, margins.

**Projection Credibility:** Implied CAGR from current to 3-year target. Flag unrealistic projections.

**Key Revenue Risks (3 items):** Specific threats to the revenue trajectory.

**Revenue Summary:** Overall revenue outlook assessment.

### Growth Opportunity Deep Dive

**Market Size Signal:** Is the target market large enough to justify the growth idea?

**Competitive Positioning:** Does the venture have a defensible moat?

**Execution Feasibility:** Does the team have bandwidth, skills, and resources?

**Growth Summary:** Overall growth opportunity quality assessment.

### PROS (3 points)

Identify 3 key strengths focusing on product-market fit evidence, team execution track record, revenue quality, and strategic clarity.

### CONS (3 points)

Identify 3 key risks focusing on unvalidated assumptions, revenue concerns, team gaps, competitive threats, and scaling risks.

### INTERVIEW QUESTIONS (3 questions with intent and red flags)

Each question structured to help the panel extract maximum signal:

- **question:** The specific question to ask the founder
- **intent:** What the panel is trying to validate

Questions should cover gaps, revenue, and growth opportunity.

---

## Output Schema

```typescript
interface PanelInsights {
    panel_recommendation: string;    // "Accept" | "Accept with Conditions" | "Defer" | "Reject"
    generated_at: string;            // ISO timestamp (added during parsing)
    executive_summary: string;       // 3-4 sentence summary
    market_context: string;          // 2-3 sentence sector landscape
    gap_deep_dive: {
        critical_gaps: string[];     // Up to 3 critical gaps
        addressable_gaps: string[];  // Up to 3 addressable gaps
        gap_summary: string;         // 1-2 sentence summary
    };
    revenue_deep_dive: {
        current_health: string;      // 1-2 sentences
        projection_credibility: string; // 1-2 sentences
        key_revenue_risks: string[]; // Up to 3 revenue risks
        revenue_summary: string;     // 1-2 sentences
    };
    growth_opportunity_deep_dive: {
        market_size_signal: string;      // 1-2 sentences
        competitive_positioning: string; // 1-2 sentences
        execution_feasibility: string;   // 1-2 sentences
        growth_summary: string;          // 1-2 sentences
    };
    strengths: string[];             // Up to 3 strengths
    risks: string[];                 // Up to 3 risks
    interview_questions: {
        question: string;
        intent: string;
    }[];                             // Up to 3 structured questions
}
```

---

## Data Flow

```
Panel Dashboard (frontend)
    │
    ├── User clicks "Generate Panel Insights"
    │   └── Optional: enters panel notes
    │
    ▼
POST /api/ventures/:id/generate-insights?type=panel
    │
    ├── 1. Fetch venture data from `ventures` table
    ├── 2. Fetch corporate_presentation_url from `venture_applications`
    ├── 3. Extract text from document (if available)
    ├── 4. Fetch prior screening insights from `ventures.ai_analysis`
    ├── 5. Build prompt with all data + VSM notes + panel notes + prior insights
    ├── 6. Call Claude API (claude-sonnet-4-5-20250929, max_tokens: 3000, temp: 0.3)
    ├── 7. Parse JSON response (with relaxed validation + fallback)
    ├── 8. Save panel insights to `ventures.panel_ai_analysis` (JSONB)
    ├── 9. Update `ventures.panel_reviewed_at`
    │
    ▼
Return panel insights to frontend
```

---

## Validation & Fallback Behavior

**Relaxed validation:** Arrays require `>= 1` items (not exact counts). Parsed arrays are sliced to max length (3 for gaps/risks/strengths, 3 for questions).

**Logging:** The API logs `stop_reason` and response length. If `stop_reason === 'max_tokens'`, a warning is logged for debugging truncation issues.

If Claude's response fails to parse as valid JSON, fallback values are returned:

```json
{
    "panel_recommendation": "Accept with Conditions",
    "executive_summary": "Evaluated \"[venture name]\" - Deep-dive AI analysis completed but requires manual panel review for final decision.",
    "market_context": "Automated analysis. Market context requires panel discussion.",
    "gap_deep_dive": {
        "critical_gaps": [
            "Strategic gap assessment requires manual review.",
            "Team capability evaluation pending panel discussion.",
            "Execution readiness to be validated in interview."
        ],
        "addressable_gaps": [
            "Go-to-market strategy can be refined with Accelerate support.",
            "Capital planning can be strengthened through mentorship.",
            "Operational scaling playbook available through program resources."
        ],
        "gap_summary": "Automated gap analysis incomplete. Panel should assess gaps during interview."
    },
    "revenue_deep_dive": {
        "current_health": "Current revenue trajectory requires panel evaluation against industry benchmarks.",
        "projection_credibility": "3-year revenue target needs validation of underlying growth assumptions.",
        "key_revenue_risks": [
            "Revenue concentration risk to be assessed.",
            "Growth rate sustainability to be validated.",
            "Margin profile requires clarification."
        ],
        "revenue_summary": "Revenue analysis requires manual deep-dive by panel."
    },
    "growth_opportunity_deep_dive": {
        "market_size_signal": "Market opportunity size requires panel assessment.",
        "competitive_positioning": "Competitive landscape and defensibility to be discussed in interview.",
        "execution_feasibility": "Team and resource readiness for growth plan requires validation.",
        "growth_summary": "Growth opportunity evaluation pending panel discussion."
    },
    "strengths": [
        "Strong revenue base (LTM).",
        "Clear focus on [growth_focus].",
        "Experienced team structure."
    ],
    "risks": [
        "Competitive landscape in new geography.",
        "Capital efficiency concern.",
        "Go-to-market strategy needs refinement."
    ],
    "interview_questions": [
        {
            "question": "How do you plan to acquire the first 10 customers in the new segment?",
            "intent": "Validate go-to-market readiness."
        },
        {
            "question": "What is the breakdown of the 3-year revenue potential?",
            "intent": "Assess revenue projection granularity."
        },
        {
            "question": "How does the current product adapt to the new market?",
            "intent": "Assess product-market fit for expansion."
        }
    ]
}
```

---

## Error Handling

| Error | HTTP Status | Message |
|-------|-------------|---------|
| Missing API key | 500 | `ANTHROPIC_API_KEY is not configured in environment variables` |
| Invalid API key | 500 | `Invalid Anthropic API key. Please check your ANTHROPIC_API_KEY.` |
| Rate limit exceeded | 500 | `Rate limit exceeded. Please try again later.` |
| JSON parse failure | N/A | Returns fallback insights (no error to user) |
| DB save failure | 200 | Insights still returned even if database update fails |

---

## Version History

- **v1.0** (2026-03-06): Initial panel interview prompt — deep-dive with structured gap/revenue/growth analysis, 5 interview questions with intent and red flags, Accept/Reject recommendation framework
- **v1.1** (2026-03-10): Performance optimization — reduced prompt size (corporate text 8000→3000, prior insights capped at 2000), lowered max_tokens 2500→3000, temperature 0.7→0.3, reduced to 3 strengths/risks/questions (from 5), relaxed array validation (>= 1 instead of exact), added stop_reason logging. Fixes 504 gateway timeout on K8s ingress.
- **v1.2** (2026-03-10): Removed `red_flag` field from interview questions — prompt, backend parsing, and frontend display. Questions now only have `question` and `intent`.

---

**Last Updated:** 2026-03-10
