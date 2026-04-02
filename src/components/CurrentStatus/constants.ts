export const DELIVERABLE_STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
    pending: { label: 'Not Started', dot: 'bg-gray-400', badge: 'text-gray-600 bg-gray-50 border-gray-200' },
    completed: { label: 'Completed', dot: 'bg-green-500', badge: 'text-green-600 bg-green-50 border-green-200' },
};

export const HEALTH_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
    on_track: { label: 'On Track', dot: 'bg-green-500', badge: 'text-green-600 bg-green-50 border-green-200' },
    needs_attention: { label: 'Needs Attention', dot: 'bg-amber-500', badge: 'text-amber-600 bg-amber-50 border-amber-200' },
    at_risk: { label: 'At Risk', dot: 'bg-red-500', badge: 'text-red-600 bg-red-50 border-red-200' },
};

export function getDeliverableStyle(del: { status: string; health?: string }): { label: string; dot: string; badge: string } {
    if (del.status === 'pending') return DELIVERABLE_STATUS_CONFIG.pending;
    if (del.status === 'completed') return DELIVERABLE_STATUS_CONFIG.completed;
    const hc = HEALTH_CONFIG[del.health || 'on_track'] || HEALTH_CONFIG.on_track;
    return { label: 'Work In Progress', dot: hc.dot, badge: hc.badge };
}

export const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Not Started' },
    { value: 'in_progress', label: 'Work In Progress' },
    { value: 'completed', label: 'Completed' },
];

export const STREAM_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
    product: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    gtm: { bg: 'bg-purple-100', text: 'text-purple-700' },
    team: { bg: 'bg-amber-100', text: 'text-amber-700' },
    capital_planning: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    supply_chain: { bg: 'bg-rose-100', text: 'text-rose-700' },
    operations: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
};

export const STREAM_LABELS: Record<string, string> = {
    product: 'Product',
    gtm: 'Go-To-Market',
    team: 'Team',
    capital_planning: 'Financial Planning',
    supply_chain: 'Supply Chain',
    operations: 'Operations',
};

export interface Deliverable {
    id: string;
    venture_id: string;
    title: string;
    description?: string;
    status: string;
    health?: string;
    priority?: string;
    owner?: string;
    start_date?: string;
    due_date?: string;
    completed_at?: string;
    display_order: number;
    roadmap_key?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface ChecklistItem {
    id: string;
    deliverable_id: string;
    text: string;
    is_completed: boolean;
    display_order: number;
    created_at: string;
}

export interface DeliverableNote {
    id: string;
    deliverable_id: string;
    note_text: string;
    action_items: string[];
    created_by?: string;
    created_at: string;
}
