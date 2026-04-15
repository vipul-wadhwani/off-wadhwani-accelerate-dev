import React, { useEffect } from 'react';
import { useBrief } from '../hooks/useBrief';
import { Loader2, Sparkles, AlertTriangle, Target, HelpCircle, CheckSquare, TrendingUp } from 'lucide-react';

interface BriefPanelProps {
    sessionId: string;
}

export const BriefPanel: React.FC<BriefPanelProps> = ({ sessionId }) => {
    const { brief, loading, generating, fetchBrief, generateBrief } = useBrief();

    useEffect(() => {
        fetchBrief(sessionId, true);
    }, [sessionId, fetchBrief]);

    const content = brief?.brief_content;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <p className="text-sm text-gray-500">Preparing your pre-meeting brief...</p>
            </div>
        );
    }

    if (!content) {
        return (
            <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">Brief generation unavailable for this session</p>
                <button
                    onClick={() => generateBrief(sessionId)}
                    disabled={generating}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? 'Generating...' : 'Retry Generation'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 text-sm">
            {/* Summary */}
            <div>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">{content.summary}</p>
            </div>

            {/* Progress */}
            {content.progress_summary && (
                <div className="flex items-start gap-2 p-3 bg-teal-50 border border-teal-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700 text-xs">{content.progress_summary}</p>
                </div>
            )}

            {/* Red Flags */}
            {content.red_flags?.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-xs font-semibold text-red-600 uppercase">Red Flags</span>
                    </div>
                    <ul className="space-y-1">
                        {content.red_flags.map((flag: string, i: number) => (
                            <li key={i} className="text-xs text-red-800 bg-red-50 border border-red-100 rounded px-3 py-1.5">
                                {flag}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Focus Areas */}
            {content.focus_areas?.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-semibold text-teal-700 uppercase">Focus Areas</span>
                    </div>
                    <ul className="space-y-1">
                        {content.focus_areas.map((area: string, i: number) => (
                            <li key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded px-3 py-1.5">
                                {area}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Key Questions */}
            {content.key_questions?.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <HelpCircle className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-semibold text-blue-600 uppercase">Key Questions</span>
                    </div>
                    <ul className="space-y-1">
                        {content.key_questions.map((q: string, i: number) => (
                            <li key={i} className="text-xs text-gray-700 bg-blue-50 border border-blue-100 rounded px-3 py-1.5">
                                {i + 1}. {q}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Action Items */}
            {content.action_items?.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <CheckSquare className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-semibold text-amber-600 uppercase">Outstanding Actions</span>
                    </div>
                    <ul className="space-y-1">
                        {content.action_items.map((item: string, i: number) => (
                            <li key={i} className="text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded px-3 py-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Regenerate */}
            <button
                onClick={() => generateBrief(sessionId)}
                disabled={generating}
                className="w-full py-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 disabled:opacity-50 flex items-center justify-center gap-1"
            >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {generating ? 'Generating...' : 'Regenerate Brief'}
            </button>

            {brief?.version && (
                <p className="text-[10px] text-gray-400 text-center">Version {brief.version} • {new Date(brief.created_at).toLocaleString()}</p>
            )}
        </div>
    );
};
