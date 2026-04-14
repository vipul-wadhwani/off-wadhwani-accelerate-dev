import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, FileText, MessageSquare, Sparkles, AlertTriangle, Target, HelpCircle, CheckSquare, TrendingUp, X, Search, Copy, ChevronDown } from 'lucide-react';
import type { MeetingRequest } from '../modules/MeetingRequests/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type ViewMode = 'summary' | 'insights' | 'preBrief';

async function getToken() {
    const { supabase } = await import('../lib/supabase');
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export const VPVMRequestDetailPage: React.FC = () => {
    const { requestId: _requestId } = useParams<{ requestId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const request = (location.state as any)?.request as MeetingRequest | undefined;
    const session = (location.state as any)?.session as any | undefined;

    const isUpcoming = request?.status === 'scheduled' || session?.status === 'scheduled';

    const [viewMode, setViewMode] = useState<ViewMode>(isUpcoming ? 'preBrief' : 'summary');
    const [showTranscript, setShowTranscript] = useState(false);
    const [summary, setSummary] = useState<any>(null);
    const [transcript, setTranscript] = useState<any>(null);
    const [brief, setBrief] = useState<any>(null);
    const [insights, setInsights] = useState<any[]>([]);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loadingTranscript, setLoadingTranscript] = useState(false);
    const [loadingBrief, setLoadingBrief] = useState(false);
    const [loadingInsights, setLoadingInsights] = useState(false);

    // Support both meeting_request (has session_id) and direct session objects
    const sessionId = request?.session_id || session?.id;

    // Normalize display data from either source
    const displayData = useMemo(() => {
        if (request) {
            return {
                title: request.meeting_goal || 'Meeting with ' + (request.expert?.full_name || 'Expert'),
                expertName: request.expert?.full_name || 'Expert',
                date: request.preferred_date,
                time: request.preferred_time,
                duration: request.preferred_duration,
                ventureName: request.venture?.name || 'Venture',
                founderName: request.venture?.founder_name || '',
                ventureId: request.venture_id,
            };
        }
        if (session) {
            return {
                title: session.topic || 'Meeting with ' + (session.expert_name || 'Expert'),
                expertName: session.expert_name || 'Expert',
                date: session.scheduled_date,
                time: session.scheduled_time,
                duration: session.duration_minutes,
                ventureName: session.venture_name || 'Venture',
                founderName: session.founder_name || '',
                ventureId: session.venture_id,
            };
        }
        return null;
    }, [request, session]);

    const fetchSummary = useCallback(async (sid: string) => {
        setLoadingSummary(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/sessions/${sid}/summary`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setSummary(data.data);
        } catch (err) { console.error('[Detail] Summary error:', err); }
        finally { setLoadingSummary(false); }
    }, []);

    const fetchTranscript = useCallback(async (sid: string) => {
        setLoadingTranscript(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/sessions/${sid}/transcript`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setTranscript(data.data);
        } catch (err) { console.error('[Detail] Transcript error:', err); }
        finally { setLoadingTranscript(false); }
    }, []);

    const fetchBrief = useCallback(async (sid: string) => {
        setLoadingBrief(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/briefs/${sid}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success && data.data) setBrief(data.data);
        } catch (err) { console.error('[Detail] Brief error:', err); }
        finally { setLoadingBrief(false); }
    }, []);

    const fetchInsights = useCallback(async (sid: string) => {
        setLoadingInsights(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/sessions/${sid}/insights`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success) setInsights(data.data || []);
        } catch (err) { console.error('[Detail] Insights error:', err); }
        finally { setLoadingInsights(false); }
    }, []);

    useEffect(() => {
        if (!sessionId) return;
        fetchSummary(sessionId);
        fetchTranscript(sessionId);
        fetchBrief(sessionId);
        fetchInsights(sessionId);
    }, [sessionId, fetchSummary, fetchTranscript, fetchBrief, fetchInsights]);

    if (!displayData) {
        return (
            <div className="text-center py-16 text-gray-500">
                <p>Meeting not found.</p>
                <button onClick={() => navigate('/vpvm/requests')} className="mt-4 text-sm text-indigo-600 hover:underline">
                    Back to Workbench
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <button onClick={() => navigate('/vpvm/requests')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Workbench
                </button>
                <h1 className="text-lg font-bold text-gray-900">
                    {displayData.ventureName}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    {displayData.founderName && (
                        <span>with <span className="font-medium text-gray-700">{displayData.founderName}</span></span>
                    )}
                    {displayData.date && (
                        <>
                            {displayData.founderName && <span className="text-gray-300">·</span>}
                            <span>{new Date(displayData.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </>
                    )}
                    {displayData.time && (
                        <>
                            <span className="text-gray-300">·</span>
                            <span>{new Date(`1970-01-01T${displayData.time}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Toggle Buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => !isUpcoming && setShowTranscript(true)}
                    disabled={isUpcoming}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                        isUpcoming
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700'
                    }`}
                >
                    <FileText className="w-4 h-4" /> Full Transcript
                </button>
                <button
                    onClick={() => !isUpcoming && setViewMode('summary')}
                    disabled={isUpcoming}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                        isUpcoming
                            ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                            : viewMode === 'summary'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <MessageSquare className="w-4 h-4" /> Transcript Summary
                </button>
                <button
                    onClick={() => setViewMode('insights')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                        viewMode === 'insights'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <TrendingUp className="w-4 h-4" /> Cumulative Insights
                </button>
                <button
                    onClick={() => setViewMode('preBrief')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
                        viewMode === 'preBrief'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    <Sparkles className="w-4 h-4" /> Pre-Meeting Brief
                </button>
            </div>

            {/* Content */}
            {viewMode === 'summary' && (
                <TranscriptSummaryView summary={summary} insights={insights} loading={loadingSummary || loadingInsights} />
            )}
            {viewMode === 'insights' && (
                <CumulativeInsightsContent insights={insights} />
            )}
            {viewMode === 'preBrief' && (
                <PreMeetingBriefContent brief={brief} loading={loadingBrief} />
            )}

            {/* Full Transcript Modal */}
            {showTranscript && (
                <TranscriptModal
                    transcript={transcript}
                    loading={loadingTranscript}
                    meetingGoal={displayData.title}
                    onClose={() => setShowTranscript(false)}
                />
            )}
        </div>
    );
};

/* ============ Transcript Summary View ============ */

const TranscriptSummaryView: React.FC<{ summary: any; insights: any[]; loading: boolean }> = ({ summary, insights, loading }) => {
    if (loading) return <LoadingSpinner />;
    if (!summary) return <EmptyState message="No meeting summary available yet." />;

    return (
        <div className="space-y-6">
            {/* Session Summary */}
            {summary.summary_text && (
                <div>
                    <SectionHeader icon={<MessageSquare className="w-4 h-4" />} label="SESSION SUMMARY" color="indigo" />
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2">
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{summary.summary_text}</p>
                    </div>
                </div>
            )}

            {/* Questions for Next Session */}
            {summary.key_points?.length > 0 && (
                <div>
                    <SectionHeader icon={<HelpCircle className="w-4 h-4" />} label="KEY POINTS FROM CALL" color="amber" />
                    <div className="mt-2 space-y-2">
                        {summary.key_points.map((point: string, i: number) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                    {i + 1}
                                </span>
                                <span className="text-gray-700">{point}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Items */}
            {summary.action_items?.length > 0 && (
                <div>
                    <SectionHeader icon={<CheckSquare className="w-4 h-4" />} label="ACTION ITEMS" color="emerald" />
                    <div className="mt-2 space-y-2">
                        {summary.action_items.map((item: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm">
                                <CheckSquare className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <span className="text-gray-800">{typeof item === 'string' ? item : item.title}</span>
                                    {item.assignee && <span className="text-xs text-gray-500 ml-2">— {item.assignee}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Live Insight Snapshots */}
            {insights.length > 0 && (
                <div>
                    <SectionHeader icon={<TrendingUp className="w-4 h-4" />} label="LIVE INSIGHT SNAPSHOTS" color="blue" />
                    <div className="mt-2 space-y-3">
                        {[...insights].sort((a: any, b: any) => {
                            if (a.is_final !== b.is_final) return a.is_final ? 1 : -1;
                            return new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime();
                        }).map((ins: any, i: number) => (
                            <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ins.is_final ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {ins.is_final ? 'FINAL' : 'SNAPSHOT'}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(ins.snapshot_time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700">{ins.summary}</p>
                                {ins.questions?.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {ins.questions.map((q: string, qi: number) => (
                                            <div key={qi} className="flex items-start gap-2 text-xs text-gray-600">
                                                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                    {qi + 1}
                                                </span>
                                                {q}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

/* ============ Full Transcript Modal ============ */

const TranscriptModal: React.FC<{ transcript: any; loading: boolean; meetingGoal: string; onClose: () => void }> = ({ transcript, loading, meetingGoal, onClose }) => {
    const [search, setSearch] = useState('');

    const chunks: any[] = transcript?.chunks || [];
    const lineCount = chunks.length || (transcript?.full_text?.split('\n').length || 0);

    const filtered = useMemo(() => {
        if (!search.trim()) return chunks;
        const q = search.toLowerCase();
        return chunks.filter((c: any) => c.text.toLowerCase().includes(q) || c.speaker.toLowerCase().includes(q));
    }, [chunks, search]);

    // Group consecutive chunks by speaker
    const grouped = useMemo(() => {
        const groups: { speaker: string; time: string; messages: string[] }[] = [];
        for (const chunk of filtered) {
            const last = groups[groups.length - 1];
            if (last && last.speaker === chunk.speaker) {
                last.messages.push(chunk.text);
            } else {
                groups.push({ speaker: chunk.speaker, time: chunk.time, messages: [chunk.text] });
            }
        }
        return groups;
    }, [filtered]);

    const copyTranscript = () => {
        const text = transcript?.full_text || chunks.map((c: any) => `${c.speaker}: ${c.text}`).join('\n');
        navigator.clipboard.writeText(text);
    };

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-200">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" /> Full Transcript
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">{meetingGoal} · {lineCount} lines</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 py-3 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search transcript..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* Transcript Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {loading ? (
                        <LoadingSpinner />
                    ) : grouped.length === 0 ? (
                        <EmptyState message="No transcript available." />
                    ) : (
                        grouped.map((group, i) => (
                            <div key={i}>
                                {/* Speaker Header */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                                            {getInitials(group.speaker)}
                                        </div>
                                        <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">{group.speaker}</span>
                                    </div>
                                    {group.time && <span className="text-[10px] text-gray-400">{group.time}</span>}
                                </div>
                                {/* Message Bubbles */}
                                <div className="space-y-1.5 ml-9">
                                    {group.messages.map((msg, mi) => (
                                        <div key={mi} className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700">
                                            {msg}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
                    <button onClick={copyTranscript} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                        <Copy className="w-3.5 h-3.5" /> Copy Full Transcript
                    </button>
                    <span className="text-xs text-gray-400">{lineCount} lines</span>
                </div>
            </div>
        </div>
    );
};

const PreMeetingBriefContent: React.FC<{ brief: any; loading: boolean }> = ({ brief, loading }) => {
    if (loading) return <LoadingSpinner />;
    const content = brief?.brief_content;
    if (!content) return <EmptyState message="No pre-meeting brief was generated for this session." />;

    return (
        <div className="space-y-5">
            {/* Overview / Summary — at the top */}
            {content.summary && (
                <div>
                    <SectionHeader icon={<FileText className="w-4 h-4" />} label="OVERVIEW" color="gray" />
                    <div className="mt-2">
                        <p className="text-sm text-gray-600 leading-relaxed">{content.summary}</p>
                    </div>
                </div>
            )}

            {/* Red Flags / Inconsistencies */}
            {content.red_flags?.length > 0 && (
                <div>
                    <SectionHeader icon={<AlertTriangle className="w-4 h-4" />} label="INCONSISTENCIES / RED FLAGS" color="red" />
                    <div className="mt-2 space-y-1.5">
                        {content.red_flags.map((flag: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-sm">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                                <span className="text-red-800">{flag}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Progress */}
            {content.progress_summary && (
                <div>
                    <SectionHeader icon={<TrendingUp className="w-4 h-4" />} label="PROGRESS" color="emerald" />
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-sm text-gray-700">{content.progress_summary}</p>
                    </div>
                </div>
            )}

            {/* Focus Areas */}
            {content.focus_areas?.length > 0 && (
                <div>
                    <SectionHeader icon={<Target className="w-4 h-4" />} label="FOCUS AREAS" color="blue" />
                    <div className="mt-2 space-y-1.5">
                        {content.focus_areas.map((area: string, i: number) => (
                            <div key={i} className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                                {area}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Key Questions */}
            {content.key_questions?.length > 0 && (
                <div>
                    <SectionHeader icon={<HelpCircle className="w-4 h-4" />} label="KEY QUESTIONS" color="amber" />
                    <div className="mt-2 space-y-2">
                        {content.key_questions.map((q: string, i: number) => (
                            <div key={i} className="flex items-start gap-3 text-sm">
                                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                    {i + 1}
                                </span>
                                <span className="text-gray-700">{q}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Items */}
            {content.action_items?.length > 0 && (
                <div>
                    <SectionHeader icon={<CheckSquare className="w-4 h-4" />} label="OUTSTANDING ACTIONS" color="amber" />
                    <div className="mt-2 space-y-1.5">
                        {content.action_items.map((item: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-900">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const SessionHistoryContent: React.FC<{ ventureId?: string; currentSessionId?: string }> = ({ ventureId, currentSessionId }) => {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [summaries, setSummaries] = useState<Record<string, any>>({});
    const [loadingSummary, setLoadingSummary] = useState<string | null>(null);

    useEffect(() => {
        if (!ventureId) return;
        (async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const res = await fetch(`${API_URL}/api/ventures/${ventureId}/mentor-sessions`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                const allSessions = data.data || data.sessions || data || [];
                setSessions(Array.isArray(allSessions) ? allSessions.filter((s: any) => s.id !== currentSessionId && s.status !== 'cancelled') : []);
            } catch (err) { console.error('[SessionHistory] error:', err); }
            finally { setLoading(false); }
        })();
    }, [ventureId, currentSessionId]);

    const toggleExpand = async (sessionId: string) => {
        if (expandedId === sessionId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(sessionId);
        // Fetch summary if not cached
        if (!summaries[sessionId]) {
            setLoadingSummary(sessionId);
            try {
                const token = await getToken();
                const res = await fetch(`${API_URL}/api/sessions/${sessionId}/summary`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                if (data.success && data.data) {
                    setSummaries(prev => ({ ...prev, [sessionId]: data.data }));
                } else {
                    setSummaries(prev => ({ ...prev, [sessionId]: null }));
                }
            } catch { setSummaries(prev => ({ ...prev, [sessionId]: null })); }
            finally { setLoadingSummary(null); }
        }
    };

    if (loading) return <LoadingSpinner />;
    if (sessions.length === 0) {
        return <EmptyState message="No other sessions found for this venture." />;
    }

    return (
        <div className="space-y-3">
            {sessions.map((s: any) => {
                const statusColor = s.status === 'ended' ? 'bg-gray-100 text-gray-600' :
                    s.status === 'scheduled' ? 'bg-emerald-100 text-emerald-700' :
                    s.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700';
                const isExpanded = expandedId === s.id;
                const sm = summaries[s.id];

                return (
                    <div key={s.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                        {/* Header — clickable to expand */}
                        <button
                            className="w-full text-left px-4 py-3 flex items-start justify-between hover:bg-gray-50 transition-colors"
                            onClick={() => toggleExpand(s.id)}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{s.topic || 'Session'}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    {s.scheduled_date && (
                                        <span>
                                            {new Date(s.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    )}
                                    {s.duration_minutes && (
                                        <>
                                            <span className="text-gray-300">·</span>
                                            <span>{s.duration_minutes} min</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase ${statusColor}`}>
                                    {s.status}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4">
                                {loadingSummary === s.id ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                    </div>
                                ) : sm ? (
                                    <>
                                        {/* Summary */}
                                        {sm.summary_text && (
                                            <div>
                                                <SectionHeader icon={<MessageSquare className="w-3.5 h-3.5" />} label="SUMMARY" color="indigo" />
                                                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{sm.summary_text}</p>
                                            </div>
                                        )}

                                        {/* Questions / Key Points */}
                                        {sm.key_points?.length > 0 && (
                                            <div>
                                                <SectionHeader icon={<HelpCircle className="w-3.5 h-3.5" />} label="QUESTIONS FOR NEXT" color="amber" />
                                                <div className="mt-1 space-y-1.5">
                                                    {sm.key_points.map((point: string, i: number) => (
                                                        <div key={i} className="flex items-start gap-2 text-xs">
                                                            <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                                {i + 1}
                                                            </span>
                                                            <span className="text-gray-700">{point}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* View Transcript link */}
                                        <button
                                            onClick={() => window.open(`/vpvm/sessions/${s.id}`, '_blank')}
                                            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                                        >
                                            <FileText className="w-3.5 h-3.5" /> View Transcript
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-xs text-gray-400 text-center py-2">No summary available for this session.</p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const CumulativeInsightsContent: React.FC<{ insights: any[] }> = ({ insights }) => {
    if (insights.length === 0) {
        return <EmptyState message="No AI insights available for this session." />;
    }

    // Build overall insights by concatenating all summaries and deduplicating questions
    const overallSummary = [...insights].reverse().map((ins: any) => ins.summary).filter(Boolean).join('\n\n');
    const allQuestions = [...insights].reverse().flatMap((ins: any) => ins.questions || []);
    const uniqueQuestions = [...new Set(allQuestions)];

    return (
        <div className="space-y-4">
            <p className="text-xs text-gray-500">Cumulative AI Analysis across {insights.length} insight{insights.length > 1 ? 's' : ''}</p>

            {/* Overall Insights Card */}
            {insights.length > 1 && (
                <div className="border-2 border-indigo-200 rounded-lg p-5 bg-indigo-50/30">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-600 text-white uppercase tracking-wider">Overall Insights</span>
                        <span className="text-[10px] text-gray-400">{insights.length} snapshots combined</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-3">{overallSummary}</p>
                    {uniqueQuestions.length > 0 && (
                        <div>
                            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Key Questions Across All Sessions</span>
                            <div className="mt-1.5 space-y-1.5">
                                {uniqueQuestions.slice(0, 10).map((q: string, qi: number) => (
                                    <div key={qi} className="flex items-start gap-2 text-xs text-gray-600">
                                        <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                            {qi + 1}
                                        </span>
                                        {q}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

/* ============ Shared Components ============ */

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; color: string }> = ({ icon, label, color }) => {
    const colorMap: Record<string, string> = {
        indigo: 'text-indigo-600',
        amber: 'text-amber-600',
        emerald: 'text-emerald-600',
        red: 'text-red-600',
        blue: 'text-blue-600',
        gray: 'text-gray-600',
    };
    return (
        <div className={`flex items-center gap-2 ${colorMap[color] || 'text-gray-600'}`}>
            {icon}
            <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        </div>
    );
};

const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
    </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center py-12 text-gray-400">
        <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">{message}</p>
    </div>
);
