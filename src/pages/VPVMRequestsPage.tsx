import React, { useEffect, useState, useMemo } from 'react';
import { useRequests } from '../modules/MeetingRequests/hooks/useRequests';
import type { MeetingRequest } from '../modules/MeetingRequests/types';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Calendar, MessageSquare, CheckCircle2, Video, Search } from 'lucide-react';

type ListTab = 'completed' | 'requests' | 'availability';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
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
