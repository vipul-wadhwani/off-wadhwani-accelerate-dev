import React from 'react';
import { Star, Briefcase, MapPin, Award } from 'lucide-react';
import type { MatchedExpert, Expert } from '../types';

interface ExpertMatchCardProps {
    expert: MatchedExpert | Expert;
    isAiMatch?: boolean;
    onSendRequest?: (expertId: string) => void;
}

export const ExpertMatchCard: React.FC<ExpertMatchCardProps> = ({ expert, isAiMatch, onSendRequest }) => {
    const matched = 'score' in expert ? expert as MatchedExpert : null;

    return (
        <div className={`bg-white border rounded-xl p-5 transition-all hover:shadow-md ${
            isAiMatch ? 'border-teal-200 ring-1 ring-teal-100' : 'border-gray-200'
        }`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                        {expert.full_name?.[0]?.toUpperCase() || 'E'}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">{expert.full_name}</h3>
                        {expert.company && (
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Briefcase className="w-3 h-3" />
                                {expert.company}
                                {'designation' in expert && expert.designation ? ` — ${expert.designation}` : ''}
                            </div>
                        )}
                    </div>
                </div>
                {matched && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-semibold">
                        <Star className="w-3 h-3" />
                        {matched.score}% match
                    </div>
                )}
            </div>

            {/* Expertise tags */}
            {expert.expertise_areas.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {expert.expertise_areas.slice(0, 4).map((area, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {area}
                        </span>
                    ))}
                    {expert.expertise_areas.length > 4 && (
                        <span className="px-2 py-0.5 text-gray-400 text-xs">+{expert.expertise_areas.length - 4}</span>
                    )}
                </div>
            )}

            {/* AI match rationale */}
            {matched?.rationale && (
                <p className="text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2 mb-3">
                    {matched.rationale}
                </p>
            )}

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                {expert.years_experience && (
                    <span className="flex items-center gap-1">
                        <Award className="w-3 h-3" /> {expert.years_experience} yrs
                    </span>
                )}
                {expert.industry_sectors.length > 0 && (
                    <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {expert.industry_sectors.slice(0, 2).join(', ')}
                    </span>
                )}
            </div>

            {/* Action */}
            {onSendRequest && (
                <button
                    onClick={() => onSendRequest(expert.id)}
                    className="w-full py-2 text-sm font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                >
                    Send Meeting Request
                </button>
            )}
        </div>
    );
};
