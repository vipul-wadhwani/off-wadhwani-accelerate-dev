import React from 'react';
import { Star } from 'lucide-react';

const STREAM_LABELS: Record<string, string> = {
    stream_gtm: 'Go-To-Market (GTM)',
    stream_product_quality: 'Product / Quality',
    stream_operations: 'Operations',
    stream_supply_chain: 'Supply Chain',
    stream_org_design: 'Org Design / Team',
    stream_finance: 'Finance / Capital',
};

const STREAM_STATUS_LABELS: Record<string, string> = {
    not_started: 'Not Started',
    on_track: 'On Track',
    need_some_advice: 'Need Some Advice',
    need_deep_support: 'Need Deep Support',
    completed: 'Completed',
};

const statusStyle = (status: string) => {
    if (status === 'need_deep_support') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'on_track' || status === 'completed') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'need_some_advice') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
};

const Field: React.FC<{ label: string; value?: string | number | null; className?: string }> = ({ label, value, className }) => {
    if (!value && value !== 0) return null;
    return (
        <div className={className}>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">{label}</span>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">{value}</p>
        </div>
    );
};

const RatingField: React.FC<{ label: string; value: number | null; max?: number }> = ({ label, value, max = 5 }) => {
    if (!value) return null;
    return (
        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-xs text-gray-400 block mb-1.5">{label}</span>
            <div className="flex items-center gap-1">
                {Array.from({ length: max }).map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < value ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                ))}
                <span className="text-sm font-bold text-gray-900 ml-1">{value}/{max}</span>
            </div>
        </div>
    );
};

const RecommendationBadge: React.FC<{ value: string }> = ({ value }) => {
    const style = value === 'proceed' ? 'bg-green-100 text-green-700'
        : value === 'hold' ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-700';
    return <span className={`text-sm font-bold px-3 py-1 rounded-full ${style} capitalize`}>{value}</span>;
};

interface PanelFeedbackReadOnlyProps {
    data: any;
}

export const PanelFeedbackReadOnly: React.FC<PanelFeedbackReadOnlyProps> = ({ data }) => {
    if (!data) return <p className="text-sm text-gray-400 text-center py-8">No panel feedback available.</p>;

    // Determine variant: Prime if prime-specific fields exist
    const isPrime = !!(data.growth_venture_type || data.rating_business_model_clarity || data.rating_historical_growth);

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
                {data.panel_expert_name && <span>Panelist: <strong className="text-gray-700">{data.panel_expert_name}</strong></span>}
                {data.panel_date && <span>Date: <strong className="text-gray-700">{new Date(data.panel_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>}
                {data.sme_name && <span>SME: <strong className="text-gray-700">{data.sme_name}</strong></span>}
            </div>

            {/* Final Recommendation */}
            {data.final_recommendation && (
                <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
                    <span className="text-xs font-bold text-gray-400 uppercase">Final Recommendation:</span>
                    <RecommendationBadge value={data.final_recommendation} />
                    {data.program_category && <span className="text-sm text-gray-500">({data.program_category})</span>}
                </div>
            )}

            {isPrime ? (
                /* ======== PRIME VARIANT ======== */
                <div className="space-y-5">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Prime Panel Feedback</h4>

                    <Field label="Growth Venture Type" value={data.growth_venture_type} />
                    <Field label="Growth Initiative Description" value={data.growth_initiative_description} />

                    <div className="grid grid-cols-2 gap-3">
                        <RatingField label="Business Model & Growth Idea Clarity" value={data.rating_business_model_clarity} />
                        <RatingField label="Historical Growth Trajectory" value={data.rating_historical_growth} />
                        <RatingField label="Financial Readiness" value={data.rating_financial_readiness} />
                        <RatingField label="Team & Leadership Quality" value={data.rating_team_leadership} />
                        <RatingField label="Execution Seriousness" value={data.rating_execution_seriousness} />
                    </div>

                    <Field label="Program Fit & Job Creation" value={data.program_fit_job_creation} />
                    <Field label="Annual Revenue FY26-27" value={data.annual_revenue_fy26_27} />
                    <Field label="Revenue Target 3Y Assumptions" value={data.revenue_target_3y_assumptions} />
                </div>
            ) : (
                /* ======== CORE/SELECT VARIANT ======== */
                <div className="space-y-5">
                    {/* Section A: Business Overview */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Section A — Business Overview</h4>
                        <Field label="Business Overview" value={data.business_overview} />
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Annual Revenue (Actuals)" value={data.annual_revenue_actuals} />
                            <Field label="Projected Annual Revenue" value={data.projected_annual_revenue} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <RatingField label="Financial Health" value={data.rating_financial_health} />
                            <RatingField label="Leadership Quality" value={data.rating_leadership} />
                        </div>
                        <Field label="Financial Health Insights" value={data.insights_financial_health} />
                        <Field label="Leadership Insights" value={data.insights_leadership} />
                    </div>

                    {/* Section B: Venture Definition */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Section B — Venture Definition</h4>

                        {data.growth_idea_types?.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Growth Idea Types</span>
                                <div className="flex gap-2">
                                    {data.growth_idea_types.map((t: string) => (
                                        <span key={t} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">{t.replace('_', ' ')}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Field label="New Product / Service" value={data.describe_new_product} />
                        <Field label="New Customer Segment" value={data.describe_new_customer} />
                        <Field label="New Geography" value={data.describe_new_geography} />
                        <Field label="Proposed Expansion Idea" value={data.proposed_expansion_idea} />
                        <Field label="Expansion Type" value={data.selected_expansion_type} />

                        {data.market_entry_routes?.length > 0 && (
                            <div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Market Entry Routes</span>
                                <div className="flex gap-2 flex-wrap">
                                    {data.market_entry_routes.map((r: string) => (
                                        <span key={r} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full border border-gray-200">{r}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Field label="Expansion Idea Description" value={data.expansion_idea_description} />
                        <Field label="Current Progress" value={data.current_progress} />
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Incremental Revenue (3Y)" value={data.incremental_revenue_3y} />
                            <Field label="Incremental Jobs (3Y)" value={data.incremental_jobs_3y} />
                        </div>
                        <RatingField label="Clarity of Expansion Idea" value={data.rating_clarity_expansion} />
                        <Field label="Clarity Comments" value={data.comments_clarity_expansion} />
                    </div>

                    {/* Section C: Support Required */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Section C — Support Required</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(STREAM_LABELS).map(([key, label]) => {
                                const status = data[key];
                                const comments = data[`${key}_comments`];
                                if (!status) return null;
                                return (
                                    <div key={key} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-gray-700">{label}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle(status)}`}>
                                                {STREAM_STATUS_LABELS[status] || status}
                                            </span>
                                        </div>
                                        {comments && <p className="text-xs text-gray-500 mt-1">{comments}</p>}
                                    </div>
                                );
                            })}
                        </div>
                        <Field label="Support Type Proposal" value={data.support_type_proposal} />
                    </div>
                </div>
            )}

            {/* Common: Risks & Notes */}
            {data.risks_red_flags && (
                <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Risks / Red Flags</span>
                    <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100 whitespace-pre-wrap">{data.risks_red_flags}</p>
                </div>
            )}

            {data.additional_notes && (
                <Field label="Additional Notes" value={data.additional_notes} />
            )}
        </div>
    );
};
