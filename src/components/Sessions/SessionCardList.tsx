import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Calendar, Video, ChevronDown, Loader2,
    MessageSquare, TrendingUp, Sparkles, FileText,
    CheckSquare, AlertTriangle, Target, HelpCircle,
} from 'lucide-react';

type ExpandedTab = 'transcript' | 'summary' | 'insights' | 'preBrief';
import { supabase } from '../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getToken(): Promise<string> {
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export type SessionLike = {
    id: string;
    venture_id?: string;
    venture_name?: string;
    founder_name?: string;
    scheduled_date?: string;
    scheduled_time?: string;
    status?: string;
    join_url?: string | null;
    [k: string]: any;
};

export type SessionCardListProps = {
    sessions: SessionLike[];
    /** Optional fallback venture info when session rows don't carry it (single-venture pages) */
    venture?: { id?: string; name?: string; founder_name?: string };
    /** If true, clicking Join routes to the in-app meeting page; otherwise opens join_url in a new tab */
    joinRoutes?: boolean;
    emptyMessage?: string;
};

export const SessionCardList: React.FC<SessionCardListProps> = ({
    sessions, venture, joinRoutes = true, emptyMessage,
}) => {
    const navigate = useNavigate();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [initialTabById, setInitialTabById] = useState<Record<string, ExpandedTab>>({});

    const expandWithTab = (sessionId: string, tab: ExpandedTab) => {
        setInitialTabById(prev => ({ ...prev, [sessionId]: tab }));
        setExpandedId(sessionId);
    };

    if (!sessions || sessions.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{emptyMessage || 'No meetings found.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {sessions.map((session) => {
                const ventureName = session.venture_name || venture?.name || 'Venture';
                const founderName = session.founder_name || venture?.founder_name;
                const ventureId = session.venture_id || venture?.id;
                const title = session.topic || session.title;
                const isExpanded = expandedId === session.id;
                const isUpcoming = session.status === 'scheduled';
                const isEnded = session.status === 'ended';

                return (
                    <div key={session.id}>
                        <div
                            className={`bg-white border border-gray-200 border-l-4 ${isUpcoming ? 'border-l-indigo-400' : 'border-l-emerald-400'} rounded-lg px-5 py-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all ${isExpanded ? 'ring-2 ring-indigo-100 border-indigo-300' : ''}`}
                            onClick={() => setExpandedId(isExpanded ? null : session.id)}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    {title ? (
                                        <>
                                            <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">{ventureName}</p>
                                        </>
                                    ) : (
                                        <p className="text-sm font-semibold text-gray-900 truncate">{ventureName}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                        {founderName && (
                                            <span>with <span className="font-medium text-gray-700">{founderName}</span></span>
                                        )}
                                        {session.scheduled_date && (
                                            <>
                                                {founderName && <span className="text-gray-300">·</span>}
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(session.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            </>
                                        )}
                                        {session.scheduled_time && (
                                            <>
                                                <span className="text-gray-300">·</span>
                                                <span>{new Date(`1970-01-01T${session.scheduled_time}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {isEnded && (
                                        <>
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                ended
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); expandWithTab(session.id, 'summary'); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" /> Summary
                                            </button>
                                        </>
                                    )}
                                    {isUpcoming && (
                                        <>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); expandWithTab(session.id, 'preBrief'); }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" /> Pre-Meeting Brief
                                            </button>
                                            {(session.join_url || joinRoutes) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (joinRoutes) navigate(`/meeting/${session.id}`);
                                                        else if (session.join_url) window.open(session.join_url, '_blank');
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                                                >
                                                    <Video className="w-3.5 h-3.5" /> Start Meeting
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>
                        </div>
                        {isExpanded && (
                            <SessionExpandedPanel
                                sessionId={session.id}
                                isUpcoming={isUpcoming}
                                ventureId={ventureId}
                                initialTab={initialTabById[session.id]}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

/* ============ Expanded Panel for a Session ============ */

export const SessionExpandedPanel: React.FC<{ sessionId: string; isUpcoming: boolean; ventureId?: string; initialTab?: ExpandedTab }> = ({
    sessionId, isUpcoming, ventureId, initialTab,
}) => {
    const [tab, setTab] = useState<ExpandedTab>(initialTab || (isUpcoming ? 'preBrief' : 'summary'));
    const [summary, setSummary] = useState<any>(null);
    const [transcript, setTranscript] = useState<any>(null);
    const [brief, setBrief] = useState<any>(null);
    const [insights, setInsights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingBrief, setLoadingBrief] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setLoading(true);
        setLoadingBrief(true);
        setBrief(null);

        (async () => {
            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };

                const fastFetch = Promise.all([
                    fetch(`${API_URL}/api/sessions/${sessionId}/summary`, { headers, signal: controller.signal }),
                    fetch(ventureId ? `${API_URL}/api/sessions/venture/${ventureId}/insights` : `${API_URL}/api/sessions/${sessionId}/insights`, { headers, signal: controller.signal }),
                    fetch(`${API_URL}/api/sessions/${sessionId}/transcript`, { headers, signal: controller.signal }),
                ]).then(async ([summaryRes, insightsRes, transcriptRes]) => {
                    if (cancelled) return;
                    const summaryData = await summaryRes.json().catch(() => ({}));
                    const insightsData = await insightsRes.json().catch(() => ({}));
                    const transcriptData = await transcriptRes.json().catch(() => ({}));
                    if (summaryData.success) setSummary(summaryData.data);
                    setInsights(insightsData.data || insightsData.insights || []);
                    if (transcriptData.success) setTranscript(transcriptData.data);
                    else if (transcriptData.data) setTranscript(transcriptData.data);
                    setLoading(false);
                });

                const briefFetch = fetch(`${API_URL}/api/briefs/${sessionId}?autoGenerate=true`, { headers, signal: controller.signal })
                    .then(async (res) => {
                        if (cancelled) return;
                        const briefData = await res.json().catch(() => ({}));
                        if (briefData.success && briefData.data) setBrief(briefData.data);
                        setLoadingBrief(false);
                    });

                await Promise.all([fastFetch, briefFetch]);
            } catch (err: any) {
                if (err.name !== 'AbortError') console.error('[SessionPanel] Fetch error:', err);
                if (!cancelled) { setLoading(false); setLoadingBrief(false); }
            }
        })();
        return () => { cancelled = true; controller.abort(); };
    }, [sessionId, ventureId]);

    const hasTranscript = Boolean(transcript?.full_text || transcript?.text);
    const hasSummary = Boolean(summary);

    const tabs: { key: ExpandedTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
        { key: 'transcript', label: 'Full Transcript', icon: <FileText className="w-3.5 h-3.5" />, disabled: isUpcoming || !hasTranscript },
        { key: 'summary', label: 'Transcript Summary', icon: <MessageSquare className="w-3.5 h-3.5" />, disabled: isUpcoming || !hasSummary },
        { key: 'insights', label: 'Cumulative Insights', icon: <TrendingUp className="w-3.5 h-3.5" /> },
        { key: 'preBrief', label: 'Pre-Meeting Brief', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ];

    // If current tab became disabled after load (e.g. no transcript/summary available), switch to first enabled tab
    useEffect(() => {
        const currentDisabled = tabs.find(t => t.key === tab)?.disabled;
        if (currentDisabled) {
            const firstEnabled = tabs.find(t => !t.disabled);
            if (firstEnabled) setTab(firstEnabled.key);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasTranscript, hasSummary, isUpcoming]);

    return (
        <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg px-5 py-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
                {tabs.map(({ key, label, icon, disabled }) => (
                    <button
                        key={key}
                        onClick={() => !disabled && setTab(key)}
                        disabled={disabled}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                            disabled
                                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                : tab === key
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {icon} {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
            ) : (
                <>
                    {tab === 'transcript' && <ExpandedTranscript transcript={transcript} />}
                    {tab === 'summary' && <ExpandedSummary summary={summary} />}
                    {tab === 'insights' && <ExpandedInsights insights={insights} />}
                    {tab === 'preBrief' && <ExpandedBrief brief={brief} loading={loadingBrief} />}
                </>
            )}
        </div>
    );
};

const ExpandedTranscript: React.FC<{ transcript: any }> = ({ transcript }) => {
    const text = transcript?.full_text || transcript?.text;
    if (!text) return <p className="text-sm text-gray-500 text-center py-4">No transcript available for this session.</p>;
    return (
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Full Transcript</p>
            <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans bg-white border border-gray-200 rounded-lg p-3 max-h-96 overflow-y-auto">{text}</pre>
        </div>
    );
};

const ExpandedSummary: React.FC<{ summary: any }> = ({ summary }) => {
    if (!summary) return <p className="text-sm text-gray-500 text-center py-4">No meeting summary available yet.</p>;
    return (
        <div className="space-y-3">
            {summary.summary_text && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Session Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{summary.summary_text}</p>
                </div>
            )}
            {summary.key_points?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Key Points</p>
                    <div className="space-y-1">
                        {summary.key_points.map((point: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                                <span>{point}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {summary.action_items?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Action Items</p>
                    <div className="space-y-1">
                        {summary.action_items.map((item: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <CheckSquare className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                <span>{typeof item === 'string' ? item : item?.title || item?.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ExpandedInsights: React.FC<{ insights: any[] }> = ({ insights }) => {
    if (!insights || insights.length === 0) return <p className="text-sm text-gray-500 text-center py-4">No cumulative insights available.</p>;

    const filtered = [...insights].filter((ins) => !ins.is_final);

    const bySession = new Map<string, any>();
    for (const ins of filtered) {
        const existing = bySession.get(ins.session_id);
        if (!existing || new Date(ins.snapshot_time) > new Date(existing.snapshot_time)) {
            bySession.set(ins.session_id, ins);
        }
    }
    const latestPerSession = [...bySession.values()].sort((a, b) =>
        new Date(b.snapshot_time).getTime() - new Date(a.snapshot_time).getTime()
    );

    const allQuestions = latestPerSession.flatMap((ins: any) => ins.questions || []);
    const uniqueQuestions = [...new Set(allQuestions)];

    const combinedSummary = latestPerSession.map((ins: any) => ins.summary).filter(Boolean).join('\n\n');

    return (
        <div className="space-y-3">
            <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50/30">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-600 text-white uppercase tracking-wider">Overall Insights</span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line mb-3">{combinedSummary}</p>
                {uniqueQuestions.length > 0 && (
                    <div>
                        <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Key Questions Across All Sessions</span>
                        <div className="mt-1.5 space-y-1.5">
                            {uniqueQuestions.slice(0, 10).map((q: any, qi: number) => (
                                <div key={qi} className="flex items-start gap-2 text-xs text-gray-600">
                                    <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                        {qi + 1}
                                    </span>
                                    {String(q)}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ExpandedBrief: React.FC<{ brief: any; loading?: boolean }> = ({ brief, loading }) => {
    if (loading) return (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <p className="text-xs text-gray-500">Preparing pre-meeting brief...</p>
        </div>
    );
    const content = brief?.brief_content;
    if (!content) return <p className="text-sm text-gray-500 text-center py-4">Brief generation unavailable for this session.</p>;
    return (
        <div className="space-y-3">
            {content.summary && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Overview</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{content.summary}</p>
                </div>
            )}
            {content.red_flags?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Red Flags</p>
                    <div className="space-y-1">
                        {content.red_flags.map((flag: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                <span className="text-red-800">{flag}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {content.focus_areas?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Focus Areas</p>
                    <div className="space-y-1">
                        {content.focus_areas.map((area: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <Target className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                                <span>{area}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {content.key_questions?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Key Questions</p>
                    <div className="space-y-1">
                        {content.key_questions.map((q: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <span>{q}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {content.progress_summary && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Progress</p>
                    <p className="text-xs text-gray-700">{content.progress_summary}</p>
                </div>
            )}
        </div>
    );
};
