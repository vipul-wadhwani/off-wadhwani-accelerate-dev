import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RoadmapStream } from '../types';
import { STREAM_LABELS } from '../types';

const SUPPORT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
    'Need Deep Support':   { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200' },
    'Need Some Guidance':  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    'Do Not Need Help':    { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
};

const STREAM_COLORS: Record<string, string> = {
    product:          'bg-violet-600',
    gtm:              'bg-blue-600',
    capital_planning: 'bg-emerald-600',
    team:             'bg-orange-500',
    supply_chain:     'bg-cyan-600',
    operations:       'bg-rose-600',
};

const PRIORITY_STYLES: Record<string, string> = {
    high:   'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low:    'bg-gray-100 text-gray-600',
    'Need deep support':  'bg-red-100 text-red-700',
    'Need some guidance': 'bg-yellow-100 text-yellow-700',
    "Don't need help":    'bg-gray-100 text-gray-600',
};

interface StreamCardProps {
    streamKey: string;
    stream: RoadmapStream;
}

const StreamCard: React.FC<StreamCardProps> = ({ streamKey, stream }) => {
    const [open, setOpen] = useState(true);
    const supportStyle = SUPPORT_STYLES[stream.support_status] ?? SUPPORT_STYLES['Need Some Guidance'];
    const accentColor = STREAM_COLORS[streamKey] ?? 'bg-indigo-600';

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden mb-3 bg-white hover:shadow-sm transition-shadow">
            {/* Stream header */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
            >
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${accentColor}`} />
                <span className="text-sm font-semibold text-gray-900 flex-1">
                    {STREAM_LABELS[streamKey] ?? streamKey}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${supportStyle.bg} ${supportStyle.text} ${supportStyle.border}`}>
                    {stream.support_status}
                </span>
                {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>

            {open && (
                <div className="px-4 pb-4">
                    {/* Goal + relevance */}
                    <div className="mb-3 space-y-1.5">
                        {stream.end_goal && (
                            <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-gray-500 w-14 flex-shrink-0 pt-0.5">Goal</span>
                                <p className="text-xs text-gray-700 leading-relaxed">{stream.end_goal}</p>
                            </div>
                        )}
                        {stream.relevance && (
                            <div className="flex items-start gap-2">
                                <span className="text-xs font-semibold text-gray-500 w-14 flex-shrink-0 pt-0.5">Why</span>
                                <p className="text-xs text-gray-500 leading-relaxed italic">{stream.relevance}</p>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    {Array.isArray(stream.actions) && stream.actions.length > 0 && (
                        <div className="space-y-2">
                            {stream.actions.map((action, i) => {
                                const priorityStyle = PRIORITY_STYLES[action.priority] ?? PRIORITY_STYLES.medium;
                                return (
                                    <div key={action.id ?? i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <span className="text-xs font-semibold text-gray-800">{action.title}</span>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priorityStyle}`}>
                                                    {action.priority}
                                                </span>
                                                {action.timeline && (
                                                    <span className="text-[10px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full">
                                                        {action.timeline}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {action.description && (
                                            <p className="text-xs text-gray-600 leading-relaxed mb-1.5">{action.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                                            {action.success_metric && (
                                                <span>✓ {action.success_metric}</span>
                                            )}
                                            {action.context_reference && (
                                                <span className="text-indigo-500">← {action.context_reference}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface Props {
    roadmap: Record<string, RoadmapStream>;
}

export const RoadmapOutput: React.FC<Props> = ({ roadmap }) => {
    const STREAM_ORDER = ['product', 'gtm', 'capital_planning', 'team', 'supply_chain', 'operations'];
    const ordered = STREAM_ORDER.filter((k) => roadmap[k]);

    return (
        <div>
            {ordered.map((key) => (
                <StreamCard key={key} streamKey={key} stream={roadmap[key]} />
            ))}
        </div>
    );
};
