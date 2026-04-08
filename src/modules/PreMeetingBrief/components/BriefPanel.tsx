import React, { useEffect } from 'react';
import { useBrief } from '../hooks/useBrief';
import { Loader2, Sparkles, AlertTriangle, Target, HelpCircle, CheckSquare, TrendingUp } from 'lucide-react';

interface BriefPanelProps {
    sessionId: string;
}

export const BriefPanel: React.FC<BriefPanelProps> = ({ sessionId }) => {
    const { brief, loading, generating, fetchBrief, generateBrief } = useBrief();

    useEffect(() => {
        fetchBrief(sessionId);
    }, [sessionId, fetchBrief]);

    const content = brief?.brief_content;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            </div>
        );
    }

    if (!content) {
        return (
            <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-4">No brief generated yet</p>
                <button
                    onClick={() => generateBrief(sessionId)}
                    disabled={generating}
                    className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? 'Generating...' : 'Generate AI Brief'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 text-sm">
            {/* Summary */}
            <div>
                <p className="text-gray-300 leading-relaxed whitespace-pre-line">{content.summary}</p>
            </div>

            {/* Progress */}
            {content.progress_summary && (
                <div className="flex items-start gap-2 p-3 bg-gray-800 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-300 text-xs">{content.progress_summary}</p>
                </div>
            )}

            {/* Red Flags */}
            {content.red_flags?.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-semibold text-red-400 uppercase">Red Flags</span>
                    </div>
                    <ul className="space-y-1">
                        {content.red_flags.map((flag: string, i: number) => (
                            <li key={i} className="text-xs text-red-300 bg-red-900/30 rounded px-3 py-1.5">
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
                        <Target className="w-4 h-4 text-teal-400" />
                        <span className="text-xs font-semibold text-teal-400 uppercase">Focus Areas</span>
                    </div>
                    <ul className="space-y-1">
                        {content.focus_areas.map((area: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300 bg-gray-800 rounded px-3 py-1.5">
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
                        <HelpCircle className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-semibold text-blue-400 uppercase">Key Questions</span>
                    </div>
                    <ul className="space-y-1">
                        {content.key_questions.map((q: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300 bg-gray-800 rounded px-3 py-1.5">
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
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-400 uppercase">Outstanding Actions</span>
                    </div>
                    <ul className="space-y-1">
                        {content.action_items.map((item: string, i: number) => (
                            <li key={i} className="text-xs text-gray-300 bg-gray-800 rounded px-3 py-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
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
                className="w-full py-2 text-xs font-medium text-teal-400 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {generating ? 'Generating...' : 'Regenerate Brief'}
            </button>

            {brief?.version && (
                <p className="text-[10px] text-gray-600 text-center">Version {brief.version} • {new Date(brief.created_at).toLocaleString()}</p>
            )}
        </div>
    );
};
