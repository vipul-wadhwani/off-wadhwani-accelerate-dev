import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, Loader2, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface InsightsPanelProps {
    sessionId: string;
    currentTranscript: string;
    topic?: string;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ sessionId, currentTranscript, topic }) => {
    const [insights, setInsights] = useState<any[]>([]);
    const [generating, setGenerating] = useState(false);

    const fetchInsights = useCallback(async () => {
        try {
            const { supabase } = await import('../../../lib/supabase');
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}/insights`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) setInsights(data.data || []);
        } catch { /* ignore */ }
    }, [sessionId]);

    useEffect(() => { fetchInsights(); }, [fetchInsights]);

    const generateSnapshot = async () => {
        if (!currentTranscript || currentTranscript.length < 20) return;
        setGenerating(true);
        try {
            const { supabase } = await import('../../../lib/supabase');
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}/insights`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ transcript: currentTranscript, topic }),
            });
            const data = await res.json();
            if (data.success && data.data) {
                setInsights(prev => [...prev, data.data]);
            }
        } catch (err) {
            console.error('[Insights] Error:', err);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-4 text-sm">
            <button
                onClick={generateSnapshot}
                disabled={generating || currentTranscript.length < 20}
                className="w-full py-2.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? 'Analyzing...' : 'Generate Insight Snapshot'}
            </button>

            {insights.length === 0 ? (
                <div className="text-center py-6">
                    <Sparkles className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Click above to generate AI insights from the conversation</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {insights.map((insight, i) => (
                        <div key={insight.id || i} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-3 h-3 text-teal-400" />
                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(insight.snapshot_time).toLocaleTimeString()}
                                </span>
                                {insight.is_final && (
                                    <span className="text-[10px] bg-teal-900 text-teal-300 px-1.5 py-0.5 rounded">Final</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-300 mb-2">{insight.summary}</p>
                            {insight.questions?.length > 0 && (
                                <div className="space-y-1">
                                    <span className="text-[10px] text-blue-400 font-semibold uppercase">Suggested Questions</span>
                                    {insight.questions.map((q: string, j: number) => (
                                        <p key={j} className="text-[11px] text-gray-400 pl-2 border-l border-blue-800">
                                            {q}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
