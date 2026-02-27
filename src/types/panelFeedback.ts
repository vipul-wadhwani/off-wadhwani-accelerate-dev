export type StreamStatus = 'not_started' | 'on_track' | 'need_some_advice' | 'need_deep_support' | 'completed';
export type FinalRecommendation = 'proceed' | 'hold' | 'revisit_later';
export type ProgramCategory = 'core' | 'select';
export type ExpansionType = 'international' | 'domestic';

export interface PanelFeedback {
    id: string;
    venture_id: string;

    // Header
    panel_expert_name: string;
    panel_date: string;
    sme_name: string | null;

    // Section A: Business Overview
    business_overview: string | null;
    annual_revenue_actuals: string | null;
    projected_annual_revenue: string | null;
    rating_financial_health: number | null;
    rating_leadership: number | null;
    insights_financial_health: string | null;
    insights_leadership: string | null;

    // Section B: Venture Definition
    proposed_expansion_idea: string | null;
    selected_expansion_type: ExpansionType | null;
    market_entry_routes: string[] | null;
    expansion_idea_description: string | null;
    current_progress: string | null;
    incremental_revenue_3y: string | null;
    incremental_jobs_3y: string | null;
    rating_clarity_expansion: number | null;
    comments_clarity_expansion: string | null;

    // Section C: Support Required
    stream_gtm: StreamStatus | null;
    stream_product_quality: StreamStatus | null;
    stream_operations: StreamStatus | null;
    stream_supply_chain: StreamStatus | null;
    stream_org_design: StreamStatus | null;
    stream_finance: StreamStatus | null;
    support_type_proposal: string | null;
    risks_red_flags: string | null;

    // Section D: Recommendation
    final_recommendation: FinalRecommendation | null;
    program_category: ProgramCategory | null;
    additional_notes: string | null;

    // Meta
    submitted_by: string | null;
    created_at: string;
    updated_at: string;
}

export type CreatePanelFeedbackInput = Omit<PanelFeedback, 'id' | 'created_at' | 'updated_at'>;
