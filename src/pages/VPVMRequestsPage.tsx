import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRequests } from '../modules/MeetingRequests/hooks/useRequests';
import type { MeetingRequest } from '../modules/MeetingRequests/types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Calendar, MessageSquare, CheckCircle2, TrendingUp, X, AlertTriangle, Target, HelpCircle, CheckSquare, Video, FileText, Search } from 'lucide-react';

type ListTab = 'completed' | 'requests' | 'availability';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

function getInitials(name: string) {
    const parts = name.split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

async function getToken() {
    const { supabase } = await import('../lib/supabase');
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export const VPVMRequestsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { loading, fetchRequests } = useRequests();
    const [activeTab, setActiveTab] = useState<ListTab>('completed');
    const [selectedRequest, setSelectedRequest] = useState<MeetingRequest | null>(null);
    const [brief, setBrief] = useState<any>(null);
    const [loadingBrief, setLoadingBrief] = useState(false);
    const [completedSessions, setCompletedSessions] = useState<any[]>([]);
    const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [companySearch, setCompanySearch] = useState('');

    useEffect(() => {
        fetchRequests({ role: 'staff' });
        // Fetch sessions from mentor_sessions (includes ops-scheduled)
        (async () => {
            setLoadingSessions(true);
            try {
                const token = await getToken();
                const [completedRes, upcomingRes] = await Promise.all([
                    fetch(`${API_URL}/api/ventures/vpvm-completed-sessions`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${API_URL}/api/ventures/vpvm-upcoming-sessions`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                const completedData = await completedRes.json();
                const upcomingData = await upcomingRes.json();
                // These endpoints use successResponse which returns data directly (no success wrapper)
                setCompletedSessions(completedData.sessions || completedData.data?.sessions || []);
                setUpcomingSessions(upcomingData.sessions || upcomingData.data?.sessions || []);
            } catch (err) { console.error('[Sessions] Fetch error:', err); }
            finally { setLoadingSessions(false); }
        })();
    }, [fetchRequests]);

    const [generatingBrief, setGeneratingBrief] = useState(false);

    // Fetch brief when a request is selected
    const fetchBrief = useCallback(async (sessionId: string) => {
        setLoadingBrief(true);
        setBrief(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/briefs/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.success && data.data) setBrief(data.data);
        } catch (err) { console.error('[Brief] Fetch error:', err); }
        finally { setLoadingBrief(false); }
    }, []);

    const generateBrief = useCallback(async () => {
        if (!selectedRequest?.session_id) return;
        setGeneratingBrief(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/briefs/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ session_id: selectedRequest.session_id }),
            });
            const data = await res.json();
            if (data.success && data.data) setBrief(data.data);
        } catch (err) { console.error('[Brief] Generate error:', err); }
        finally { setGeneratingBrief(false); }
    }, [selectedRequest]);

    useEffect(() => {
        if (selectedRequest?.session_id) {
            fetchBrief(selectedRequest.session_id);
        } else {
            setBrief(null);
        }
    }, [selectedRequest, fetchBrief]);

    const counts = useMemo(() => {
        const opsUpcoming = upcomingSessions.filter(s => s.source === 'ops_scheduled').length;
        const opsCompleted = completedSessions.filter(s => s.source === 'ops_scheduled').length;
        return { total: opsCompleted + opsUpcoming, pending: 0, completed: opsCompleted, in_progress: opsUpcoming, declined: 0 };
    }, [completedSessions, upcomingSessions]);

    // Convert upcoming VP/VM sessions (ops_scheduled only) into a format similar to MeetingRequest for display
    const sessionsAsRequests = useMemo(() => {
        return upcomingSessions.filter(s => s.source === 'ops_scheduled').map((s): MeetingRequest => ({
            id: s.id,
            venture_id: s.venture_id,
            expert_id: s.mentor_id,
            requested_by: '',
            requested_by_role: s.source === 'ops_scheduled' ? 'ops_manager' : 'venture_mgr',
            meeting_goal: s.topic || null,
            problem_statement: null,
            company_info: null,
            preferred_date: s.scheduled_date,
            preferred_time: s.scheduled_time,
            preferred_duration: s.duration_minutes || 60,
            status: 'scheduled',
            expert_response_note: null,
            responded_at: null,
            session_id: s.id,
            created_at: s.created_at || '',
            updated_at: s.created_at || '',
            venture: { id: s.venture_id, name: s.venture_name, founder_name: s.founder_name },
            expert: { id: s.mentor_id, full_name: s.expert_name || 'Session', email: '' },
        }));
    }, [upcomingSessions]);

    const allRequests = useMemo(() => {
        // Only show VP/VM sessions (ops_scheduled) in Upcoming Meetings — no expert requests
        return sessionsAsRequests;
    }, [sessionsAsRequests]);

    const requestsList = allRequests;

    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

    if (loading || loadingSessions) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const stats = [
        { label: 'Total', value: counts.total, bg: 'bg-indigo-50/50 border border-indigo-200/60', text: 'text-indigo-600', num: 'text-indigo-700' },
        { label: 'Upcoming', value: counts.pending + counts.in_progress, bg: 'bg-amber-50/50 border border-amber-200/60', text: 'text-amber-600', num: 'text-amber-600' },
        { label: 'Completed', value: counts.completed, bg: 'bg-emerald-50/50 border border-emerald-200/60', text: 'text-emerald-600', num: 'text-emerald-700' },
    ];

    const mainTabs: { key: ListTab; label: string; icon: React.ReactNode }[] = [
        { key: 'completed', label: 'Completed Meetings', icon: <CheckCircle2 className="w-4 h-4" /> },
        { key: 'requests', label: 'Upcoming Meetings', icon: <MessageSquare className="w-4 h-4" /> },
    ];

    return (
        <div className="space-y-6">
            {/* Greeting */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                    {userName[0]?.toUpperCase()}
                </div>
                <h1 className="text-xl font-bold text-gray-900">{getGreeting()}, {userName}</h1>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-3">
                {stats.map(({ label, value, bg, text, num }) => (
                    <div key={label} className={`rounded-xl p-4 text-center ${bg}`}>
                        <div className={`text-3xl font-bold ${num}`}>{value}</div>
                        <div className={`text-sm font-medium mt-1 ${text}`}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Tab Bar */}
            <div className="border-b border-gray-200">
                <div className="flex gap-6">
                    {mainTabs.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            onClick={() => {
                                if (key === 'availability') { navigate('/vpvm/availability'); return; }
                                setActiveTab(key);
                                setSelectedRequest(null);
                            }}
                            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by company..."
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
            </div>

            {/* Content */}
            {activeTab === 'completed' && (
                <CompletedSessionsList sessions={completedSessions.filter(s => s.source === 'ops_scheduled').filter(s => !companySearch || s.venture_name?.toLowerCase().includes(companySearch.toLowerCase()))} navigate={navigate} />
            )}
            {activeTab === 'requests' && (
                <div className="space-y-2">
                    {requestsList.filter(req => !companySearch || req.venture?.name?.toLowerCase().includes(companySearch.toLowerCase())).length === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No upcoming meetings found.</p>
                        </div>
                    ) : (
                        requestsList.filter(req => !companySearch || req.venture?.name?.toLowerCase().includes(companySearch.toLowerCase())).map((req) => (
                            <RequestCard
                                key={req.id}
                                request={req}
                                isSelected={false}
                                onSelect={() => req.session_id && navigate(`/vpvm/sessions/${req.session_id}`, { state: { request: req } })}
                                onStartMeeting={() => req.session_id && navigate(`/meeting/${req.session_id}`)}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

/* ============ Completed Sessions List (from mentor_sessions) ============ */

const CompletedSessionsList: React.FC<{ sessions: any[]; navigate: any }> = ({ sessions, navigate }) => {
    if (sessions.length === 0) {
        return (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No completed meetings found.</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {sessions.map((session) => (
                <div
                    key={session.id}
                    className="bg-white border border-gray-200 border-l-4 border-l-emerald-400 rounded-lg px-5 py-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
                    onClick={() => navigate(`/vpvm/sessions/${session.id}`, { state: { session } })}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                                {session.venture_name || 'Venture'}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                <span>with <span className="font-medium text-gray-700">{session.founder_name || 'Venture Owner'}</span></span>
                                {session.scheduled_date && (
                                    <>
                                        <span className="text-gray-300">·</span>
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
                    </div>
                </div>
            ))}
        </div>
    );
};

/* ============ Request Card (for Meeting Requests tab) ============ */

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
    accepted: { bg: 'bg-green-100', text: 'text-green-700' },
    declined: { bg: 'bg-red-100', text: 'text-red-700' },
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-700' },
    cancelled: { bg: 'bg-gray-100', text: 'text-gray-500' },
};

const RequestCard: React.FC<{
    request: MeetingRequest;
    isSelected: boolean;
    onSelect: () => void;
    onStartMeeting: () => void;
}> = ({ request, isSelected, onSelect, onStartMeeting }) => {
    return (
        <div
            className={`bg-white border border-l-4 border-l-indigo-400 rounded-lg px-5 py-4 cursor-pointer transition-all ${
                isSelected ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
            onClick={onSelect}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                        {request.venture?.name || 'Venture'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                        {request.venture?.founder_name && (
                            <span>with <span className="font-medium text-gray-700">{request.venture.founder_name}</span></span>
                        )}
                        {request.preferred_date && (
                            <>
                                {request.venture?.founder_name && <span className="text-gray-300">·</span>}
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(request.preferred_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                            </>
                        )}
                        {request.preferred_time && (
                            <>
                                <span className="text-gray-300">·</span>
                                <span>{new Date(`1970-01-01T${request.preferred_time}`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                            </>
                        )}
                    </div>
                </div>
                {(request.status === 'accepted' || request.status === 'scheduled') && request.session_id && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onStartMeeting(); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0 ml-3"
                    >
                        <Video className="w-3.5 h-3.5" /> Start Meeting
                    </button>
                )}
            </div>
        </div>
    );
};

/* ============ Request Detail Panel (Right Side) ============ */

const RequestDetailPanel: React.FC<{
    request: MeetingRequest;
    brief: any;
    loadingBrief: boolean;
    onClose: () => void;
    onGenerateBrief: () => void;
    generatingBrief: boolean;
}> = ({ request, brief, loadingBrief, onClose, onGenerateBrief, generatingBrief }) => {
    const expertName = request.expert?.full_name || 'Expert';
    const content = brief?.brief_content;
    const [ventureInfo, setVentureInfo] = useState<any>(null);
    const [roadmap, setRoadmap] = useState<any>(null);

    // Fetch venture details + roadmap for overview
    useEffect(() => {
        if (!request.venture_id) return;
        const vid = request.venture_id;
        (async () => {
            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };
                const [ventureRes, roadmapRes] = await Promise.all([
                    fetch(`${API_URL}/api/ventures/${vid}`, { headers }),
                    fetch(`${API_URL}/api/ventures/${vid}/roadmap`, { headers }),
                ]);
                const ventureData = await ventureRes.json();
                setVentureInfo(ventureData.venture || ventureData.data || ventureData);
                const roadmapData = await roadmapRes.json();
                setRoadmap(roadmapData.roadmap || roadmapData.data?.roadmap || roadmapData.data || null);
            } catch { /* ignore */ }
        })();
    }, [request.venture_id]);

    // Build structured overview from venture + roadmap data
    const ventureOverview = useMemo(() => {
        if (!ventureInfo) return null;
        const app = ventureInfo.application || ventureInfo;
        return {
            description: app.product_description || ventureInfo.description || null,
            problem: app.problem_statement || null,
            product: app.current_product || null,
            segment: app.current_segment || null,
            location: app.current_geography || ventureInfo.location || ventureInfo.city || null,
            founder: ventureInfo.founder_name || app.founder_name || null,
            revenue: app.revenue_12m || null,
            employees: app.full_time_employees || null,
            growthFocus: Array.isArray(ventureInfo.growth_focus) ? ventureInfo.growth_focus : (Array.isArray(app.growth_focus) ? app.growth_focus : null),
        };
    }, [ventureInfo]);

    // Extract roadmap streams
    const roadmapStreams = useMemo(() => {
        if (!roadmap?.roadmap_data?.streams) return null;
        return roadmap.roadmap_data.streams.map((s: any) => ({
            name: s.stream_name || s.name || 'Stream',
            status: s.status || 'N/A',
            goal: s.goal || s.description || null,
        }));
    }, [roadmap]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                        {getInitials(expertName)}
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{expertName}</h2>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Company */}
                <DetailSection icon={<TrendingUp className="w-4 h-4" />} label="COMPANY" color="text-gray-500">
                    <p className="text-sm text-gray-900 font-medium">{request.venture?.name || 'Venture'}</p>
                    {request.preferred_date && (
                        <p className="text-xs text-gray-500 mt-1">
                            {new Date(request.preferred_date).toLocaleDateString('en-IN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                            {request.preferred_time && ` · ${request.preferred_time.slice(0, 5)}`}
                        </p>
                    )}
                </DetailSection>

                {/* Venture Overview */}
                {ventureOverview && (
                    <DetailSection icon={<FileText className="w-4 h-4" />} label="VENTURE OVERVIEW" color="text-gray-500">
                        <div className="space-y-2 text-xs">
                            {ventureOverview.description && (
                                <p className="text-gray-700 leading-relaxed">{ventureOverview.description}</p>
                            )}
                            {ventureOverview.problem && (
                                <p className="text-gray-600"><span className="font-medium text-gray-800">Problem:</span> {ventureOverview.problem}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-gray-600">
                                {ventureOverview.founder && <p><span className="font-medium text-gray-800">Founder:</span> {ventureOverview.founder}</p>}
                                {ventureOverview.location && <p><span className="font-medium text-gray-800">Location:</span> {ventureOverview.location}</p>}
                                {ventureOverview.product && <p><span className="font-medium text-gray-800">Product:</span> {ventureOverview.product}</p>}
                                {ventureOverview.segment && <p><span className="font-medium text-gray-800">Segment:</span> {ventureOverview.segment}</p>}
                                {ventureOverview.revenue && <p><span className="font-medium text-gray-800">Revenue (12m):</span> {ventureOverview.revenue}</p>}
                                {ventureOverview.employees && <p><span className="font-medium text-gray-800">Employees:</span> {ventureOverview.employees}</p>}
                            </div>
                            {ventureOverview.growthFocus && ventureOverview.growthFocus.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {ventureOverview.growthFocus.map((g: string, i: number) => (
                                        <span key={i} className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-medium">{g}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </DetailSection>
                )}

                {/* AI Overview — from brief summary */}
                {content?.summary && (
                    <DetailSection icon={<FileText className="w-4 h-4" />} label="OVERVIEW" color="text-gray-500">
                        <p className="text-sm text-gray-700 leading-relaxed">{content.summary}</p>
                    </DetailSection>
                )}

                {/* Roadmap Streams */}
                {roadmapStreams && roadmapStreams.length > 0 && (
                    <DetailSection icon={<Target className="w-4 h-4" />} label="ROADMAP" color="text-blue-600">
                        <div className="space-y-1.5">
                            {roadmapStreams.map((s: any, i: number) => {
                                const statusColor = s.status === 'Green (On Track)' ? 'bg-emerald-100 text-emerald-700' :
                                    s.status?.includes('Amber') ? 'bg-amber-100 text-amber-700' :
                                    s.status?.includes('Red') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
                                return (
                                    <div key={i} className="flex items-start gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 mt-0.5 ${statusColor}`}>
                                            {s.status?.split(' ')[0] || '—'}
                                        </span>
                                        <div>
                                            <span className="font-medium text-gray-800">{s.name}</span>
                                            {s.goal && <p className="text-gray-500 mt-0.5">{s.goal}</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </DetailSection>
                )}

                {/* Meeting Goal */}
                {request.meeting_goal && (
                    <DetailSection icon={<MessageSquare className="w-4 h-4" />} label="MEETING GOAL" color="text-indigo-600">
                        <p className="text-sm text-gray-700">{request.meeting_goal}</p>
                    </DetailSection>
                )}

                {/* Pre-Meeting Brief */}
                {loadingBrief ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    </div>
                ) : content ? (
                    <>
                        <div className="border-t border-gray-100 pt-4">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">PRE-MEETING BRIEF</span>
                        </div>

                        {/* Red Flags */}
                        {content.red_flags?.length > 0 && (
                            <DetailSection icon={<AlertTriangle className="w-4 h-4" />} label="RED FLAGS" color="text-red-600">
                                <div className="space-y-1.5">
                                    {content.red_flags.map((flag: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs">
                                            <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-red-800">{flag}</span>
                                        </div>
                                    ))}
                                </div>
                            </DetailSection>
                        )}

                        {/* Outstanding Action Items */}
                        {content.action_items?.length > 0 && (
                            <DetailSection icon={<CheckSquare className="w-4 h-4" />} label="OUTSTANDING ACTION ITEMS" color="text-amber-600">
                                <div className="space-y-1.5">
                                    {content.action_items.map((item: string, i: number) => (
                                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-900">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </DetailSection>
                        )}

                        {/* Progress */}
                        {content.progress_summary && (
                            <DetailSection icon={<TrendingUp className="w-4 h-4" />} label="PROGRESS" color="text-emerald-600">
                                <p className="text-xs text-gray-700">{content.progress_summary}</p>
                            </DetailSection>
                        )}

                        {/* Focus Areas */}
                        {content.focus_areas?.length > 0 && (
                            <DetailSection icon={<Target className="w-4 h-4" />} label="FOCUS AREAS FOR THIS SESSION" color="text-blue-600">
                                <div className="space-y-2">
                                    {content.focus_areas.map((area: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 text-xs">
                                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <span className="text-gray-700">{area}</span>
                                        </div>
                                    ))}
                                </div>
                            </DetailSection>
                        )}

                        {/* Suggested Questions */}
                        {content.key_questions?.length > 0 && (
                            <DetailSection icon={<HelpCircle className="w-4 h-4" />} label="SUGGESTED QUESTIONS" color="text-indigo-600">
                                <div className="space-y-2">
                                    {content.key_questions.map((q: string, i: number) => (
                                        <div key={i} className="flex items-start gap-3 text-xs">
                                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <span className="text-gray-700">{q}</span>
                                        </div>
                                    ))}
                                </div>
                            </DetailSection>
                        )}

                    </>
                ) : request.session_id ? (
                    <div className="text-center py-6 text-gray-400">
                        <Sparkles className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs mb-3">No pre-meeting brief generated yet.</p>
                        <button
                            onClick={onGenerateBrief}
                            disabled={generatingBrief}
                            className="px-4 py-2 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 mx-auto"
                        >
                            {generatingBrief ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {generatingBrief ? 'Generating...' : 'Generate AI Brief'}
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

/* ============ Shared ============ */

const DetailSection: React.FC<{ icon: React.ReactNode; label: string; color: string; children: React.ReactNode }> = ({ icon, label, color, children }) => (
    <div>
        <div className={`flex items-center gap-2 mb-2 ${color}`}>
            {icon}
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        </div>
        {children}
    </div>
);

// Need Sparkles import for the empty brief state
const Sparkles = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
);
