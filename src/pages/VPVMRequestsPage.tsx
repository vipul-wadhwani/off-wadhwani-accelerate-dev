import React, { useEffect, useState, useMemo } from 'react';
import { useRequests } from '../modules/MeetingRequests/hooks/useRequests';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, MessageSquare, CheckCircle2, Search } from 'lucide-react';
import { SessionCardList } from '../components/Sessions/SessionCardList';

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

    // Ops-scheduled upcoming sessions, normalised for SessionCardList
    const upcomingOpsSessions = useMemo(() => {
        return upcomingSessions
            .filter(s => s.source === 'ops_scheduled')
            .map(s => ({ ...s, status: 'scheduled' }));
    }, [upcomingSessions]);

    const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

    if (loading || loadingSessions) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    const stats: { label: string; value: number; bg: string; text: string; num: string; tab?: ListTab }[] = [
        { label: 'Total', value: counts.total, bg: 'bg-indigo-50/50 border border-indigo-200/60', text: 'text-indigo-600', num: 'text-indigo-700' },
        { label: 'Upcoming', value: counts.pending + counts.in_progress, bg: 'bg-amber-50/50 border border-amber-200/60', text: 'text-amber-600', num: 'text-amber-600', tab: 'requests' },
        { label: 'Completed', value: counts.completed, bg: 'bg-emerald-50/50 border border-emerald-200/60', text: 'text-emerald-600', num: 'text-emerald-700', tab: 'completed' },
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
                {stats.map(({ label, value, bg, text, num, tab }) => (
                    <div
                        key={label}
                        onClick={() => tab && setActiveTab(tab)}
                        className={`rounded-xl p-4 text-center ${bg} ${tab ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                    >
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
                <SessionCardList
                    sessions={completedSessions
                        .filter(s => s.source === 'ops_scheduled')
                        .filter(s => !companySearch || s.venture_name?.toLowerCase().includes(companySearch.toLowerCase()))
                        .map(s => ({ ...s, status: s.status || 'ended' }))}
                    emptyMessage="No completed meetings found."
                />
            )}
            {activeTab === 'requests' && (
                <SessionCardList
                    sessions={upcomingOpsSessions.filter(s => !companySearch || s.venture_name?.toLowerCase().includes(companySearch.toLowerCase()))}
                    emptyMessage="No upcoming meetings found."
                />
            )}
        </div>
    );
};
