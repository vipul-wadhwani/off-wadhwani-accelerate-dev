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
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const fetchInsights = useCallback(async () => {
        try {
            const { supabase } = await import('../../../lib/supabase');
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}/insights`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.success) {
                setInsights(data.data || []);
                if ((data.data || []).length > 0) setSelectedIndex((data.data || []).length - 1);
            }
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
                setInsights(prev => {
                    const updated = [...prev, data.data];
                    setSelectedIndex(updated.length - 1);
                    return updated;
                });
            }
        } catch (err) {
            console.error('[Insights] Error:', err);
        } finally {
            setGenerating(false);
        }
    };

    const selected = selectedIndex !== null && insights[selectedIndex] ? insights[selectedIndex] : null;

    return (
        <div className="space-y-4 text-sm">
            {/* Generate Button */}
            <button
                onClick={generateSnapshot}
                disabled={generating || currentTranscript.length < 20}
                className="w-full py-2.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? 'Analyzing...' : 'Generate Insights Snapshot'}
            </button>

            {insights.length === 0 ? (
                <div className="text-center py-6">
                    <Sparkles className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Click above to generate AI insights from the conversation</p>
                </div>
            ) : (
                <>
                    {/* Snapshot Pills */}
                    <div>
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Snapshots</span>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {insights.map((insight, i) => {
                                const time = new Date(insight.snapshot_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const isActive = selectedIndex === i;
                                return (
                                    <button
                                        key={insight.id || i}
                                        onClick={() => setSelectedIndex(i)}
                                        className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                                            isActive
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {time}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected Snapshot Content */}
                    {selected && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(selected.snapshot_time).toLocaleTimeString()}
                                    {selected.transcript_length && ` · ${selected.transcript_length} new lines`}
                                </span>
                                {selected.is_final && (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">FINAL</span>
                                )}
                            </div>

                            {/* Summary */}
                            <div>
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Summary</span>
                                <p className="text-xs text-gray-700 mt-1 leading-relaxed">{selected.summary}</p>
                            </div>

                            {/* Suggested Questions */}
                            {selected.questions?.length > 0 && (
                                <div>
                                    <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Suggested Questions</span>
                                    <div className="mt-1.5 space-y-1.5">
                                        {selected.questions.map((q: string, j: number) => (
                                            <div key={j} className="flex items-start gap-2 text-xs">
                                                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                    {j + 1}
                                                </span>
                                                <span className="text-gray-700">{q}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
