# V1 — Screening Manager Insights Prompt

## Purpose

Generate structured AI-powered screening insights for venture applications. Used by Venture Screening Managers (VSMs) to evaluate startups applying to the Wadhwani Accelerate program.

The prompt produces two focused outputs:

1. **Existing Venture Profile** — A concise summary of the current business and its product growth history.
2. **New Venture Definition Clarity** — An assessment of how clearly the applicant has defined their new growth idea, with a clarity flag, estimated incremental revenue commentary, and a panel recommendation.

**Source:** `backend/src/services/aiService.ts` → `buildInsightsPrompt()`

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 2,000 |
| **Temperature** | 0.7 |
| **API Endpoint** | `POST /api/ventures/:id/generate-insights?type=screening` |
| **Allowed Roles** | `success_mgr`, `venture_mgr`, `committee_member`, `admin` |
| **Estimated Cost** | ~$0.02-0.04 per generation |

---

## When Used

Triggered when the Screening Manager clicks **"Generate AI Analysis"** on the VSM Dashboard during initial application review.

---

## Input Data

```typescript
interface VentureData {
    id: string;
    name: string;
    founder_name?: string;
    revenue_12m?: number;
    revenue_potential_3y?: number;
    full_time_employees?: number;
    growth_focus?: string;
    growth_current?: any;        // JSONB - current product/segment/geography
    growth_target?: any;         // JSONB - target product/segment/geography
    commitment?: any;            // JSONB
    vsm_notes?: string;
    corporate_presentation_text?: string;  // Extracted from uploaded PDF/PPT
}
```

**Corporate Presentation:** If the venture has uploaded a corporate presentation, the text is extracted via `documentService.extractDocumentText()` and included in the prompt (truncated at 8,000 characters).

---

## Prompt Template

```
You are an expert screening analyst for the Accelerate Assisted Growth Platform. Your role is to evaluate a venture application and produce a focused screening reference for the Screening Manager.

Your output must cover exactly two things:

1. **Existing Venture Profile** — A concise summary of the current business, highlighting its current products and growth history.
2. **New Venture Definition Clarity** — Assess how clearly the applicant has defined their proposed new growth idea, and whether the application is ready to be recommended to the interview panel.

You will receive a venture application containing:
- Business details (company name, type, city, state, designation, products/services, customer segments, regions, employee count, revenue)
- Growth idea details (type: new product/service, new segment, or new geography; expected incremental revenue in 3 years; funding plan)
- Support areas requested (Product, Go-To-Market, Capital Planning, Team, Supply Chain, Operations)
- Support description (free text from applicant)
- Screening manager notes (optional free text with additional context from initial review)
- Corporate presentation (optional attachment)

**Venture Information:**
- Company Name: ${ventureData.name}
- Founder: ${ventureData.founder_name || 'N/A'}
- Current Revenue (12M): ₹${ventureData.revenue_12m?.toLocaleString() || 'N/A'}
- Target Revenue (3Y): ₹${ventureData.revenue_potential_3y?.toLocaleString() || 'N/A'}
- Full-Time Employees: ${ventureData.full_time_employees || 'N/A'}
- Growth Focus: ${ventureData.growth_focus || 'N/A'}
- Current Market: ${JSON.stringify(ventureData.growth_current || {})}
- Target Market: ${JSON.stringify(ventureData.growth_target || {})}

**Screening Manager's Notes:**
${vsmNotes || 'No additional notes provided.'}

**Corporate Presentation Content:**
${ventureData.corporate_presentation_text?.slice(0, 8000) || 'No corporate presentation provided.'}
[... truncated ...]

**Your Task:**
Provide your assessment in the following JSON format:

{
  "existing_venture_profile": {
    "profile_summary": "<3-4 sentence summary of the existing business. Cover: what the company does (core products/services), who it serves, where it operates, its current revenue scale, and team size. This should give the screening manager a complete at-a-glance picture of the business today.>",
    "current_product_growth_history": "<2-3 sentences describing the current product portfolio and historical growth trajectory. Mention specific products/services by name where available. State whether the business has been growing, flat, or declining based on available revenue data or signals. If the application provides only current revenue with no prior-year comparator, state: 'Insufficient data to assess historical growth — only current-year revenue provided.'>"
  },
  "new_venture_clarity": {
    "new_product_or_service": "<What new product or service is the venture pursuing? If clearly defined, describe it specifically. If vague or not mentioned, state: 'Not clearly defined — [explain what is missing].'>",
    "new_segment_or_market": "<What new customer segment or market is being targeted? If clearly defined, describe it specifically. If vague or not mentioned, state: 'Not clearly defined — [explain what is missing].'>",
    "new_geography": "<What new geography is being targeted? If clearly defined, name the specific regions/countries. If not applicable (growth idea is product or segment focused, not geography), state: 'Not applicable — growth idea is focused on new product/segment, not geographic expansion.' If vague, state: 'Not clearly defined — [explain what is missing].'>",
    "estimated_incremental_revenue": "<State the 3-year incremental revenue figure from the application (₹). Then assess: Is this figure substantiated (backed by assumptions, market sizing, unit economics, or a build-up) or aspirational (a round number with no supporting logic)?>",
    "definition_clarity_flag": "<One of: Well Defined, Partially Defined, or Poorly Defined>",
    "clarity_gaps": [
      "<Specific gap 1 — what is missing or vague in the new venture definition>",
      "<Specific gap 2>",
      "<Specific gap 3>"
    ],
    "clarity_summary": "<2-3 sentence summary of the new venture idea and its readiness for panel review.>"
  }
}

**Critical Instructions for Existing Venture Profile:**
- Extract information from ALL available sources: application fields, corporate presentation text, and screening manager notes.
- The profile_summary should give the screening manager a complete picture of the business in 3-4 sentences — what it does, who it serves, where it operates, and its current scale.
- The current_product_growth_history must name specific products where available and assess growth trajectory factually. If the application provides only current revenue with no prior-year figure, flag historical growth as "Insufficient data" — do NOT fabricate or assume a growth rate.

**Critical Instructions for New Venture Definition Clarity:**
- Evaluate ONLY based on what the applicant has explicitly stated. Do not infer or assume details they haven't provided.
- The definition_clarity_flag is determined by how many of the applicable dimensions (new product/service, new segment/market, new geography) are clearly and specifically articulated:
  - "Well Defined" = All applicable dimensions are specifically described with concrete details (named product, named segment, named geography).
  - "Partially Defined" = At least one dimension is clear, but others are vague, generic, or missing.
  - "Poorly Defined" = Most dimensions are vague, use generic language ("expand to new markets"), or are missing entirely.
- clarity_gaps must contain exactly 3 items. If fewer than 3 gaps exist, note minor gaps or areas that could be further strengthened.

Return ONLY the JSON object, no additional text.
```

---

## Output Format Guidelines

### Existing Venture Profile

This section gives the screening manager a concise snapshot of the business today, focused on what it does and how it has been growing.

**profile_summary:** A 3-4 sentence glanceable summary covering the company's core products/services, customer segments, operating geography, current revenue scale, and team size. The screening manager should be able to read this and immediately understand the business.

**current_product_growth_history:** A 2-3 sentence description of the current product portfolio and its growth trajectory. Name specific products/services where the application provides them. Assess whether the business has been growing, flat, or declining — citing revenue figures, employee growth, or other signals from the application. If no prior-year data is available, explicitly flag as "Insufficient data" rather than guessing.

### New Venture Definition Clarity

This is the core decision-support section. It answers: *"Has this applicant clearly thought through what they want to build, for whom, and where — and is it specific enough to discuss with the panel?"*

**new_product_or_service:** A well-defined answer names the product, describes its value proposition, and explains how it differs from current offerings. A poorly defined answer says something like "we want to expand our product line."

**new_segment_or_market:** A well-defined answer identifies the specific segment, their pain point, and why this venture is positioned to serve them. A poorly defined answer is generic ("new customers").

**new_geography:** A well-defined answer names specific cities, states, or countries with rationale. If the growth idea is not geography-based, mark as "Not applicable."

**estimated_incremental_revenue:** State the 3-year figure and assess whether it is *substantiated* (backed by market sizing, unit economics, or a revenue build-up) or *aspirational* (a round number with no supporting logic).

**definition_clarity_flag:**

| Flag | Meaning |
|------|---------|
| **Well Defined** | All applicable dimensions (product, segment, geography) are specific, concrete, and internally consistent. The applicant has described what they will build, for whom, and where. |
| **Partially Defined** | At least one dimension is well-articulated, but others are generic, missing, or contradictory. The panel can discuss it but should probe the gaps. |
| **Poorly Defined** | Most dimensions are vague, use generic language, or are missing entirely. The application does not provide enough detail for a meaningful panel discussion. |

**clarity_gaps (3 items):** Specific, actionable observations about what is missing or vague. Examples: "No specific product features or value proposition described for the new offering," "Target geography mentioned as 'international' without naming countries or regions," "No explanation of how the new segment differs from current customer base."

**clarity_summary:** A 2-3 sentence glanceable summary for the screening manager.

---

## Output Schema

```typescript
interface ScreeningInsights {
    existing_venture_profile: {
        profile_summary: string;
        current_product_growth_history: string;
    };
    new_venture_clarity: {
        new_product_or_service: string;
        new_segment_or_market: string;
        new_geography: string;
        estimated_incremental_revenue: string;
        definition_clarity_flag: string;   // "Well Defined" | "Partially Defined" | "Poorly Defined"
        clarity_gaps: string[];            // Exactly 3 items
        clarity_summary: string;
    };
    generated_at: string;  // ISO timestamp (added during parsing)
}
```

---

## Data Flow

```
VSM Dashboard (frontend)
    │
    ├── User clicks "Generate AI Analysis"
    │   └── Optional: enters VSM notes
    │
    ▼
POST /api/ventures/:id/generate-insights?type=screening
    │
    ├── 1. Fetch venture data from `ventures` table
    ├── 2. Fetch corporate_presentation_url from `venture_applications`
    ├── 3. Extract text from document (if available)
    ├── 4. Build V1 prompt with venture data + VSM notes + document text
    ├── 5. Call Claude API (claude-sonnet-4-5-20250929)
    ├── 6. Parse JSON response (with fallback)
    ├── 7. Save insights to `ventures.ai_analysis` (JSONB)
    ├── 8. Update `ventures.vsm_reviewed_at`
    │
    ▼
Return screening insights to frontend
```

---

## Fallback Behavior

If Claude's response fails to parse as valid JSON:

```json
{
    "existing_venture_profile": {
        "profile_summary": "Automated analysis of existing venture incomplete. Screening manager should review application and corporate presentation manually.",
        "current_product_growth_history": "Insufficient data — automated extraction incomplete. Manual review required to assess current products and growth history."
    },
    "new_venture_clarity": {
        "new_product_or_service": "Unable to assess — manual review required.",
        "new_segment_or_market": "Unable to assess — manual review required.",
        "new_geography": "Unable to assess — manual review required.",
        "estimated_incremental_revenue": "₹[revenue_potential_3y] stated in application — substantiation not assessed.",
        "definition_clarity_flag": "Partially Defined",
        "clarity_gaps": [
            "Automated analysis could not evaluate new product/service definition.",
            "Automated analysis could not evaluate target segment/market definition.",
            "Automated analysis could not evaluate geographic expansion definition."
        ],
        "clarity_summary": "AI analysis incomplete. Screening manager should manually assess whether the new venture idea is clearly defined before proceeding to panel."
    }
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

- **v1.0** (2026-02-17): Initial prompt (documented as GPT-4 based)
- **v2.0** (2026-03-01): Migrated to Claude API, JSON output format, corporate presentation support
- **v3.0** (2026-03-06): Split into V1 (screening) and V2 (panel) prompts
- **v3.1** (2026-03-06): Restructured V1 to focus exclusively on Existing Venture Profile and New Venture Definition Clarity. Removed pros/cons/questions/gap-revenue-job assessments. Added definition_clarity_flag and recommend_for_panel.
- **v3.2** (2026-03-06): Removed venture_success_probability and probability_rationale fields.
- **v3.3** (2026-03-06): Simplified existing_venture_profile to profile_summary and current_product_growth_history only.
- **v3.4** (2026-03-06): Removed recommend_for_panel and panel_recommendation_rationale fields.

---

**Last Updated:** 2026-03-06
