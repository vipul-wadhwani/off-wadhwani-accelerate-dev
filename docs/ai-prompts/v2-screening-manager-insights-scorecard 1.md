# V2 — Screening Manager Scorecard Insights Prompt

## Purpose

Generate a structured SCALE scorecard for venture applications. Used by Venture Screening Managers (VSMs) to evaluate startups applying to the Wadhwani Accelerate program.

The prompt produces a **single scorecard table** with 7 dimensions — each rated **Red / Yellow / Green** with a one-to-two-line description. No lengthy narratives. The screening manager should be able to glance at the table and immediately understand where the venture stands.

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
| **Tools Required** | `web_search_20260209` — used by the AI for Sector growth data lookup |

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
    program_type?: string;       // "core" | "select" | "prime"
    revenue_12m?: number;
    revenue_potential_3y?: number;
    full_time_employees?: number;
    growth_focus?: string;
    growth_dimensions_selected?: string[];  // Which growth dimensions the venture selected (min 1 required): ["new_product_service", "new_segment_market", "new_geography"]
    growth_current?: any;        // JSONB - current product/segment/geography
    growth_target?: any;         // JSONB - target product/segment/geography
    commitment?: any;            // JSONB - leadership commitment responses
    vsm_notes?: string;
    corporate_presentation_text?: string;  // Extracted from uploaded PDF/PPT
    financial_condition?: string;          // Liquidity indicator from application form
    planned_hires_3y?: number;            // Jobs planned over 3 years
    time_commitment?: string;             // Owner/founder time commitment level
    second_line_team?: string;            // Availability of second-in-line management
}
```

**Corporate Presentation:** If the venture has uploaded a corporate presentation, the text is extracted via `documentService.extractDocumentText()` and included in the prompt (truncated at 8,000 characters).

---

## Scorecard Dimensions & Evaluation Rules

### 1. Size — Current Revenue

| Rating | Core | Select | Prime (Startups) |
|--------|----------------|-------------------|----------------------------|
| **Green** | ARR ₹25Cr–₹85Cr ($3M–$10M) | ARR ₹85Cr–₹425Cr ($10M–$50M) | ARR ≥ ₹4Cr ($500K) with visible path to ₹25Cr ($3M) in 3 yrs |
| **Yellow** | ARR ₹10Cr–₹25Cr — below Core threshold but growing | ARR ₹50Cr–₹85Cr — below Select threshold | ARR ₹1Cr–₹4Cr — early but some traction |
| **Red** | ARR < ₹10Cr — too small for Core | ARR < ₹50Cr for Select consideration | ARR < ₹1Cr or no revenue — pre-revenue / insufficient scale |

### 2. Sector — Growth Sector Attractiveness

| Rating | Criteria |
|--------|----------|
| **Green** | Venture operates in a sector with 8%+ 3-year CAGR and sector projected to grow above GDP |
| **Yellow** | Sector growing at GDP-level (5–8% CAGR) or mixed signals — some sub-segments growing, others flat |
| **Red** | Sector stagnant or declining (< 5% CAGR), heavily commoditised, or facing structural headwinds |

**Web Search Required:** The AI must use the `web_search` tool to look up current sector growth data. The search should be based on the sector inferred from the venture's described products/services and target market. The brief must cite the sector identified and the growth data found via search — not rely on static knowledge alone.

*Implementation Note: The Claude API call for this prompt must include the web search tool in the `tools` parameter:*
```javascript
tools: [
    {
        "type": "web_search_20260209",
        "name": "web_search"
    }
]
```

### 3. Capital — Balance Sheet Strength

| Rating | Core / Select (SMBs) | Prime (Startups) |
|--------|---------------------------------------------|----------------------------|
| **Green** | Positive cash flow & PAT (profit after tax) | 12+ months cash runway |
| **Yellow** | Cash-flow positive but PAT-negative, or PAT-positive but tight working capital | 6–12 months runway |
| **Red** | Negative cash flow and PAT; debt-heavy balance sheet | < 6 months runway or not disclosed |

*Note: Evaluate based on the financial_condition response from the application form.*

### 4. Ambition — Revenue Addition Target

| Rating | Core / Select (SMBs) | Prime (Startups) |
|--------|---------------------------------------------|----------------------------|
| **Green** | Min 8% incremental CAGR; on track to double revenue in 5 years | On track to min double revenue in 3 years |
| **Yellow** | 4–8% incremental CAGR; growth target exists but modest | 50–100% growth in 3 years — ambitious but not doubling |
| **Red** | < 4% incremental CAGR or no clear revenue target | < 50% growth target in 3 years or target not stated |

*Note: Calculate implied CAGR from revenue_12m and revenue_potential_3y.*

### 5. Leadership — Committed Team

| Rating | Criteria |
|--------|----------|
| **Green** | Owner/founder commits to personal involvement in the program AND a second-generation or second-in-line management team is in place to run day-to-day operations |
| **Yellow** | Owner/founder commits time but no clear second-line team, OR second-line team exists but owner/founder availability is limited |
| **Red** | Owner/founder cannot commit time AND no second-line management team available |

*Note: Evaluate based on time_commitment and second_line_team fields from the application form, plus any signals from the corporate presentation.*

### 6. Jobs / Employment Generation Potential — Direct Job Creation Potential (3 years)

| Rating | Core / Prime (Startups) | Select |
|--------|-----------------------------------------------|-------------------|
| **Green** | 50+ direct jobs (including contract) planned over 3 years | 150+ direct jobs planned over 3 years |
| **Yellow** | 25–49 jobs planned | 75–149 jobs planned |
| **Red** | < 25 jobs planned or not disclosed | < 75 jobs planned or not disclosed |

*Note: Evaluate based on planned_hires_3y from the application form.*

### 7. Venture Clarity — New Venture Definition

The venture must select **at least one** growth dimension from: New Product/Service, New Segment/Market, New Geography. Venture Clarity is assessed **only against the dimensions the venture has selected and provided data for**. Dimensions not selected by the venture are ignored — they do not count as gaps.

| Rating | Criteria |
|--------|----------|
| **Green** | All **selected** growth dimensions are specifically described with concrete details — named product, named segment, named geography (as applicable). The venture idea is well-articulated and ready for panel discussion. |
| **Yellow** | At least one selected dimension is clearly defined, but other selected dimensions are vague or generic. Panel can discuss but should probe the gaps in the selected areas. |
| **Red** | Most or all selected dimensions are vague, use generic language ("expand to new markets"), or lack substantive detail despite being selected. Application does not provide enough clarity on its own chosen growth focus for a meaningful panel discussion. |

*Note: Evaluate based on growth_dimensions_selected, growth_focus, growth_current, growth_target, and corporate_presentation_text. Only assess the dimensions the venture has explicitly selected. If a venture selected only "New Product/Service", evaluate clarity solely on that dimension — do not penalise for not having segment or geography details.*

---

## Prompt Template

```
You are an expert screening analyst for the Wadhwani Accelerate Assisted Growth Platform. Your role is to evaluate a venture application and produce a SCALE scorecard — a simple, glanceable table that the Screening Manager can use for quick decision-making.

Your output is a scorecard with exactly 7 dimensions. For each dimension, provide:
- A **rating**: Green, Yellow, or Red
- A **brief** (exactly 2 sentences): Sentence 1 states the key data point or finding specific to this venture. Sentence 2 explains the implication or why it maps to the given rating. Briefs must be dynamic — reference the venture's actual data, never use generic boilerplate.

Do NOT write lengthy narratives. The screening manager wants a quick-glance table, not a report.

**SCALE Scorecard Dimensions:**

1. **Size** — Current revenue scale. Is the venture large enough for the program?
   - Green: Core with $3M–$10M ARR; Select with $10M–$50M ARR; Prime (Startups) with $500K+ ARR and visible path to $3M in 3 years.
   - Yellow: Below threshold for the applicable program but showing growth momentum.
   - Red: Significantly below minimum threshold or pre-revenue.
   - Use the venture's program type to apply the correct thresholds.

2. **Sector** — Growth sector attractiveness. Is the sector growing?
   - Green: Sector at 8%+ 3-year CAGR, projected to grow above GDP.
   - Yellow: Sector growing at GDP-level (5–8%) or mixed signals.
   - Red: Sector stagnant, declining, or facing structural headwinds.
   - IMPORTANT: You MUST use the web_search tool to look up current growth data for the sector the venture operates in. Identify the sector from the venture's product/service description and target market, then search for "[sector name] India market size CAGR growth" or similar. Your brief must reference the specific sector identified and the growth data found. Do NOT rely solely on static knowledge — always search.

3. **Capital** — Balance sheet strength. Can the venture fund this growth?
   - Green: Positive cash flow & PAT for Core/Select (SMBs); 12+ month runway for Prime (startups).
   - Yellow: Cash-flow positive but PAT-negative for SMBs; 6–12 month runway for startups.
   - Red: Negative cash flow and PAT; < 6 month runway; or not disclosed.

4. **Ambition** — Revenue addition target. Is the growth target ambitious enough?
   - Green: Min 8% incremental CAGR, doubling revenue in 5 years for Core/Select (SMBs) or 3 years for Prime (startups).
   - Yellow: Moderate growth target (4–8% CAGR).
   - Red: < 4% CAGR or no clear revenue target stated.
   - Calculate the implied CAGR from current 12-month revenue and the 3-year target revenue provided.

5. **Leadership** — Committed team. Will the leadership invest time?
   - Green: Owner/founder personally committed to the program AND second-in-line management team in place.
   - Yellow: One of the two (time commitment or second-line team) is weak or unclear.
   - Red: Neither founder commitment nor second-line team availability is evident.

6. **Jobs / Employment Generation Potential** — Direct job creation potential over 3 years (including contract roles).
   - Green: 50+ jobs for Core / Prime (Startups); 150+ jobs for Select.
   - Yellow: 25–49 jobs (Core/Prime); 75–149 jobs (Select).
   - Red: < 25 jobs or not disclosed (Core/Prime); < 75 jobs or not disclosed (Select).

7. **Venture Clarity** — How clearly has the applicant defined their new growth idea?
   - The venture has selected one or more growth dimensions from: New Product/Service, New Segment/Market, New Geography. Assess clarity ONLY for the dimensions they selected — ignore dimensions they did not choose.
   - Green: All **selected** dimensions are specific, concrete, and well-articulated.
   - Yellow: At least one selected dimension is clear, but other selected dimensions are vague or generic.
   - Red: Most or all selected dimensions are vague, generic, or lack substantive detail despite being chosen.
   - Evaluate ONLY based on what the applicant has explicitly stated for their selected dimensions. Do NOT penalise for dimensions they did not select. Do NOT infer or assume details.

**Venture Information:**
- Company Name: ${ventureData.name}
- Founder: ${ventureData.founder_name || 'N/A'}
- Program: ${ventureData.program_type || 'N/A'}
- Current Revenue (12M): ₹${ventureData.revenue_12m?.toLocaleString() || 'N/A'}
- Target Revenue (3Y): ₹${ventureData.revenue_potential_3y?.toLocaleString() || 'N/A'}
- Full-Time Employees: ${ventureData.full_time_employees || 'N/A'}
- Growth Focus: ${ventureData.growth_focus || 'N/A'}
- Growth Dimensions Selected: ${JSON.stringify(ventureData.growth_dimensions_selected || [])}
- Current Market: ${JSON.stringify(ventureData.growth_current || {})}
- Target Market: ${JSON.stringify(ventureData.growth_target || {})}
- Financial Condition: ${ventureData.financial_condition || 'N/A'}
- Planned Hires (3Y): ${ventureData.planned_hires_3y || 'N/A'}
- Time Commitment: ${ventureData.time_commitment || 'N/A'}
- Second-Line Management Team: ${ventureData.second_line_team || 'N/A'}

**Screening Manager's Notes:**
${vsmNotes || 'No additional notes provided.'}

**Corporate Presentation Content:**
${ventureData.corporate_presentation_text?.slice(0, 8000) || 'No corporate presentation provided.'}
[... truncated ...]

**Your Task:**
Return your assessment in the following JSON format. Return ONLY the JSON object, no additional text.

{
  "scorecard": [
    {
      "dimension": "Size",
      "assessment": "Current Revenue",
      "rating": "<Green | Yellow | Red>",
      "brief": "<1–2 sentence explanation>"
    },
    {
      "dimension": "Sector",
      "assessment": "Growth Sector",
      "rating": "<Green | Yellow | Red>",
      "brief": "<1–2 sentence explanation>"
    },
    {
      "dimension": "Capital",
      "assessment": "Balance Sheet Strength",
      "rating": "<Green | Yellow | Red>",
      "brief": "<1–2 sentence explanation>"
    },
    {
      "dimension": "Ambition",
      "assessment": "Revenue Addition",
      "rating": "<Green | Yellow | Red>",
      "brief": "<1–2 sentence explanation>"
    },
    {
      "dimension": "Leadership",
      "assessment": "Committed Team",
      "rating": "<Green | Yellow | Red>",
      "brief": "<1–2 sentence explanation>"
    },
    {
      "dimension": "Jobs / Employment Generation Potential",
      "assessment": "Direct Jobs Creation (3Y)",
      "rating": "<Green | Yellow | Red>",
      "brief": "<1–2 sentence explanation>"
    },
    {
      "dimension": "Venture Clarity",
      "assessment": "New Venture Definition",
      "rating": "<Green | Yellow | Red>",
      "brief": "<1–2 sentence explanation>"
    }
  ]
}

**Critical Instructions:**
- Each "brief" must be exactly 2 sentences. Sentence 1: state the key data point or finding specific to this venture (e.g., the actual revenue figure, the sector name and CAGR found, the specific commitment response). Sentence 2: explain the implication or why it maps to the given rating. Briefs must be dynamic and contextual — never use generic/boilerplate language. Reference the venture's actual data.
- Each "rating" must be exactly one of: "Green", "Yellow", or "Red".
- For "Size", apply the thresholds for the venture's specific program (Core, Select, or Prime). Reference the actual ARR figure in the brief.
- For "Sector", you MUST use the web_search tool to find current sector growth data. Identify the sector from the venture's products/services and target market, search for its CAGR/growth outlook (e.g., "[sector] India market CAGR growth forecast"), and cite the sector name and growth figure in your brief. Do NOT skip the web search.
- For "Ambition", calculate the implied CAGR: CAGR = (revenue_potential_3y / revenue_12m)^(1/3) − 1. State the calculated CAGR in the brief. If either figure is missing, rate as Red.
- For "Capital", use the financial_condition field. If not provided, rate as Red with brief "Financial condition not disclosed."
- For "Leadership", evaluate both the founder's time commitment AND the availability of a second-in-line management team. Both must be strong for Green. Reference the specific responses in the brief.
- For "Jobs / Employment Generation Potential", apply thresholds based on the venture's program type. Reference the actual planned hires figure in the brief.
- For "Venture Clarity", assess ONLY the growth dimensions the venture has selected (listed in "Growth Dimensions Selected"). Do not penalise for dimensions they did not choose. If a venture selected only one dimension and defined it clearly, that is Green. Evaluate based on what the applicant has explicitly stated — do not infer or assume details. Name the specific dimensions assessed in the brief.
- If data for a dimension is missing or insufficient, default to Red and state what is missing in the brief.

Return ONLY the JSON object, no additional text.
```

---

## Output Schema

```typescript
interface ScorecardDimension {
    dimension: string;     // "Size" | "Sector" | "Capital" | "Ambition" | "Leadership" | "Jobs / Employment Generation Potential" | "Venture Clarity"
    assessment: string;    // Short label for the assessment area
    rating: string;        // "Green" | "Yellow" | "Red"
    brief: string;         // Exactly 2 sentences: data point + implication, specific to the venture
}

interface ScreeningScorecardInsights {
    scorecard: ScorecardDimension[];  // Exactly 7 items
    generated_at: string;             // ISO timestamp (added during parsing)
}
```

---

## Frontend Rendering Guidance

The scorecard should render as a simple table on the VSM Dashboard:

| SCALE Dimension | Assessment | Rating | Brief |
|-----------------|-----------|--------|-------|
| Size | Current Revenue | 🟢 Green | The venture reports ₹45Cr ARR, placing it comfortably within the Core range (₹25Cr–₹85Cr). No size concerns for program eligibility. |
| Sector | Growth Sector | 🟢 Green | The venture operates in the industrial automation sector, which is growing at ~12% CAGR per recent market reports. This is well above GDP growth, indicating a strong tailwind. |
| Capital | Balance Sheet Strength | 🟡 Yellow | The venture reports positive cash flow but has not disclosed PAT status. Clarification needed on profitability before a Green rating can be assigned. |
| Ambition | Revenue Addition | 🟢 Green | The 3Y target of ₹90Cr from a ₹45Cr base implies a ~26% CAGR, well above the 8% threshold. The venture is on track to double revenue within the program period. |
| Leadership | Committed Team | 🟡 Yellow | The founder has committed to personal involvement in the program. However, no second-in-line management team has been identified to manage day-to-day operations. |
| Jobs / Employment Generation Potential | Direct Jobs Creation (3Y) | 🟢 Green | The venture plans to hire 80+ employees (including contract) over 3 years, exceeding the Core threshold of 50 jobs. Strong job creation signal. |
| Venture Clarity | New Venture Definition | 🟡 Yellow | The new product (IoT sensors for predictive maintenance) is well-defined with clear features and value proposition. However, the target customer segment is described generically as "manufacturing companies" without specifying sub-segments or pain points. |

**Colour mapping:** Green = `#22C55E`, Yellow = `#EAB308`, Red = `#EF4444`

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
    ├── 4. Build V2 scorecard prompt with venture data + VSM notes + document text
    ├── 5. Call Claude API (claude-sonnet-4-5-20250929) with web_search tool enabled
    ├── 6. AI uses web_search for Sector growth data during generation
    ├── 6. Parse JSON response (with fallback)
    ├── 7. Save insights to `ventures.ai_analysis` (JSONB)
    ├── 8. Update `ventures.vsm_reviewed_at`
    │
    ▼
Return scorecard insights to frontend
```

---

## Fallback Behavior

If Claude's response fails to parse as valid JSON:

```json
{
    "scorecard": [
        {
            "dimension": "Size",
            "assessment": "Current Revenue",
            "rating": "Yellow",
            "brief": "Automated analysis incomplete. Manual review required."
        },
        {
            "dimension": "Sector",
            "assessment": "Growth Sector",
            "rating": "Yellow",
            "brief": "Automated analysis incomplete. Manual review required."
        },
        {
            "dimension": "Capital",
            "assessment": "Balance Sheet Strength",
            "rating": "Yellow",
            "brief": "Automated analysis incomplete. Manual review required."
        },
        {
            "dimension": "Ambition",
            "assessment": "Revenue Addition",
            "rating": "Yellow",
            "brief": "Automated analysis incomplete. Manual review required."
        },
        {
            "dimension": "Leadership",
            "assessment": "Committed Team",
            "rating": "Yellow",
            "brief": "Automated analysis incomplete. Manual review required."
        },
        {
            "dimension": "Jobs / Employment Generation Potential",
            "assessment": "Direct Jobs Creation (3Y)",
            "rating": "Yellow",
            "brief": "Automated analysis incomplete. Manual review required."
        },
        {
            "dimension": "Venture Clarity",
            "assessment": "New Venture Definition",
            "rating": "Yellow",
            "brief": "Automated analysis incomplete. Manual review required."
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
| JSON parse failure | N/A | Returns fallback scorecard (no error to user) |
| DB save failure | 200 | Insights still returned even if database update fails |

---

## Migration Notes (V1 → V2)

| What changed | V1 (Previous) | V2 (Scorecard) |
|-------------|---------------|----------------|
| **Output structure** | Two narrative sections (Existing Venture Profile + New Venture Clarity) | Single scorecard array with 7 rated dimensions |
| **Reading effort** | Multi-paragraph prose requiring careful reading | Glanceable table — rating + 1–2 line brief per row |
| **Dimensions covered** | Profile summary, growth history, product/segment/geography clarity, clarity flag | Size, Sector, Capital, Ambition, Leadership, Jobs / Employment Generation Potential, Venture Clarity |
| **New input fields** | N/A | `financial_condition`, `planned_hires_3y`, `time_commitment`, `second_line_team` |
| **Rating system** | Single `definition_clarity_flag` (Well/Partially/Poorly Defined) | Per-dimension Red/Yellow/Green |
| **Panel readiness signal** | Implicit from clarity flag | Composite — screening manager reads the 7 ratings at a glance |

---

## Version History

- **v1.0** (2026-02-17): Initial prompt (documented as GPT-4 based)
- **v2.0** (2026-03-01): Migrated to Claude API, JSON output format, corporate presentation support
- **v3.0** (2026-03-06): Split into V1 (screening) and V2 (panel) prompts
- **v3.1** (2026-03-06): Restructured V1 — Existing Venture Profile + New Venture Definition Clarity
- **v3.2** (2026-03-06): Removed venture_success_probability fields
- **v3.3** (2026-03-06): Simplified existing_venture_profile
- **v3.4** (2026-03-06): Removed recommend_for_panel fields
- **v4.0** (2026-03-13): **Complete redesign** — Replaced narrative-based V1 with SCALE scorecard (7 dimensions: Size, Sector, Capital, Ambition, Leadership, Jobs / Employment Generation Potential, Venture Clarity). Red/Yellow/Green rating per dimension. Added new input fields for financial condition, planned hires, time commitment, and second-line team.
- **v4.1** (2026-03-13): Updated Venture Clarity to assess only the growth dimensions the venture has selected (min 1 required). Ventures are not penalised for dimensions they did not choose. Added `growth_dimensions_selected` input field.

---

**Last Updated:** 2026-03-13
