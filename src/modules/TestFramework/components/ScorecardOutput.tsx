import React from 'react';
import type { ScorecardDimension, PanelScorecardDimension, Rating } from '../types';

const RATING_STYLES: Record<Rating, { badge: string; dot: string }> = {
    Green:  { badge: 'bg-green-100 text-green-800 border-green-200',  dot: 'bg-green-500' },
    Yellow: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400' },
    Red:    { badge: 'bg-red-100 text-red-800 border-red-200',    dot: 'bg-red-500' },
};

function RatingBadge({ rating }: { rating: Rating }) {
    const s = RATING_STYLES[rating] ?? RATING_STYLES.Yellow;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.badge}`}>
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            {rating}
        </span>
    );
}

// ─── Screening scorecard ──────────────────────────────────────────────────────

interface ScreeningProps { scorecard: ScorecardDimension[] }

export const ScreeningScorecard: React.FC<ScreeningProps> = ({ scorecard }) => (
    <div className="space-y-2">
        {scorecard.map((dim) => (
            <div
                key={dim.dimension}
                className="border border-gray-200 rounded-xl p-4 bg-white hover:shadow-sm transition-shadow"
            >
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">{dim.dimension}</div>
                        <div className="text-xs text-gray-500">{dim.assessment}</div>
                    </div>
                    <RatingBadge rating={dim.rating} />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{dim.brief}</p>
            </div>
        ))}
    </div>
);

// ─── Panel scorecard ──────────────────────────────────────────────────────────

interface PanelProps { scorecard: PanelScorecardDimension[] }

export const PanelScorecard: React.FC<PanelProps> = ({ scorecard }) => (
    <div className="space-y-2">
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-gray-500 px-1 pb-1">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300" /> Application rating</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-200 border border-indigo-300" /> Panel rating</span>
        </div>

        {scorecard.map((dim) => {
            const changed = dim.application_rating !== dim.panel_rating;
            return (
                <div
                    key={dim.dimension}
                    className={`border rounded-xl p-4 bg-white hover:shadow-sm transition-shadow ${changed ? 'border-amber-300' : 'border-gray-200'}`}
                >
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="text-sm font-semibold text-gray-900">{dim.dimension}</div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Application rating */}
                            <div className="flex flex-col items-center gap-0.5">
                                <RatingBadge rating={dim.application_rating as Rating} />
                                <span className="text-[10px] text-gray-400">Application</span>
                            </div>
                            {changed && (
                                <span className="text-gray-400 text-sm">→</span>
                            )}
                            {/* Panel rating */}
                            <div className="flex flex-col items-center gap-0.5">
                                <RatingBadge rating={dim.panel_rating as Rating} />
                                <span className="text-[10px] text-indigo-500 font-medium">Panel</span>
                            </div>
                        </div>
                    </div>
                    {changed && (
                        <div className="mb-1.5">
                            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Rating changed
                            </span>
                        </div>
                    )}
                    <p className="text-xs text-gray-600 leading-relaxed">{dim.panel_brief}</p>
                </div>
            );
        })}
    </div>
);
