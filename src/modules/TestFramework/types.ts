// ─── Feature types ────────────────────────────────────────────────────────────

export type Feature = 'screening' | 'panel' | 'roadmap';

export const FEATURES: { id: Feature; label: string; description: string }[] = [
    {
        id: 'screening',
        label: 'Screening Manager Scorecard',
        description: 'SCALE scorecard (7 dimensions) generated from venture application data',
    },
    {
        id: 'panel',
        label: 'Panel Scorecard',
        description: 'Panel recommendation scorecard comparing application vs discussion findings',
    },
    {
        id: 'roadmap',
        label: 'Venture Journey Roadmap',
        description: '6-stream actionable roadmap for approved ventures',
    },
];

// ─── Venture list (selector) ─────────────────────────────────────────────────

export interface VentureSummary {
    id: string;
    name: string;
    founder_name?: string;
    status: string;
    program_recommendation?: string;
    created_at: string;
}

// ─── Model config ─────────────────────────────────────────────────────────────

export interface ModelConfig {
    model: string;
    max_tokens: number;
    temperature: number;
    tools: string[];
}

// ─── Context response ─────────────────────────────────────────────────────────

export interface ContextResponse {
    inputContext: Record<string, any>;
    prompt: string;
    modelConfig: ModelConfig;
}

// ─── Run response ─────────────────────────────────────────────────────────────

export interface RunResponse {
    rawText: string;
    parsed: any;
    feature: Feature;
    durationMs: number;
}

// ─── Scorecard types ─────────────────────────────────────────────────────────

export type Rating = 'Green' | 'Yellow' | 'Red';

export interface ScorecardDimension {
    dimension: string;
    assessment: string;
    rating: Rating;
    brief: string;
}

export interface PanelScorecardDimension {
    dimension: string;
    application_rating: Rating;
    panel_rating: Rating;
    panel_brief: string;
}

// ─── Roadmap types ────────────────────────────────────────────────────────────

export interface RoadmapAction {
    id: string;
    title: string;
    description: string;
    context_reference: string;
    timeline: string;
    success_metric: string;
    status: string;
    priority: string;
}

export interface RoadmapStream {
    relevance: string;
    support_status: string;
    end_goal: string;
    actions: RoadmapAction[];
}

export const STREAM_LABELS: Record<string, string> = {
    product: 'Product',
    gtm: 'Go-to-Market',
    capital_planning: 'Capital Planning',
    team: 'Team',
    supply_chain: 'Supply Chain',
    operations: 'Operations',
};
