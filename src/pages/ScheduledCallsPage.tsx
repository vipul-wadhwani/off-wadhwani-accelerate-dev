import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
    Loader2,
    Calendar,
    Copy,
    Check,
    XCircle,
    Clock,
    Search,
} from 'lucide-react';

interface ScheduledCall {
    id: string;
    venture_id: string;
    panelist_id: string;
    call_date: string;
    start_time: string;
    end_time: string;
    status: string;
    meet_link: string;
    notes?: string;
    cancellation_reason?: string;
    created_at: string;
    cancelled_at?: string;
    completed_at?: string;
    venture?: {
        id: string;
        name: string;
        founder_name?: string;
        status: string;
        program_recommendation?: string;
    };
    panelist?: {
        id: string;
        name: string;
        email: string;
        program: string;
    };
}

type Tab = 'upcoming' | 'history';

function formatTime(time: string): string {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
}

function formatDateBold(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatDateShort(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

function getTomorrow(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function getDayAfterTomorrow(): string {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
}

function getVentureStatusBadge(venture?: ScheduledCall['venture']) {
    if (!venture) return null;
    const status = venture.status;
    const program = venture.program_recommendation;

    if (status === 'Panel Review' && (program || '').toLowerCase().includes('prime')) {
        return { label: 'Pending with Panel (Prime)', color: 'text-purple-700', bg: 'bg-purple-50' };
    }
    if (status === 'Panel Review') {
        return { label: 'Pending with Panel (Core/Select)', color: 'text-indigo-700', bg: 'bg-indigo-50' };
    }
    if (status === 'Assign VP/VM') {
        return { label: 'Assign VP/VM', color: 'text-purple-700', bg: 'bg-purple-50' };
    }
    if (status === 'With VP/VM') {
        return { label: 'With VP/VM', color: 'text-purple-700', bg: 'bg-purple-50' };
    }
    if (status === 'Approved') {
        return { label: 'Accepted by Business', color: 'text-green-700', bg: 'bg-green-50' };
    }
    if (status === 'Rejected') {
        return { label: 'Declined by Business', color: 'text-red-700', bg: 'bg-red-50' };
    }
    return { label: status, color: 'text-gray-700', bg: 'bg-gray-50' };
}

export const ScheduledCallsPage: React.FC = () => {
    const [calls, setCalls] = useState<ScheduledCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('upcoming');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const fetchCalls = async () => {
        setLoading(true);
        try {
            const data = await api.getScheduledCalls();
            setCalls(data.scheduled_calls || []);
        } catch (err) {
            console.error('Error fetching scheduled calls:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCalls();
    }, []);

    const today = getToday();
    const tomorrow = getTomorrow();
    const dayAfter = getDayAfterTomorrow();

    const upcomingCalls = calls.filter(c => c.status === 'scheduled' && c.call_date >= today);
    const historyCalls = calls.filter(c => c.status !== 'scheduled' || c.call_date < today);

    const todayCalls = upcomingCalls.filter(c => c.call_date === today);
    const tomorrowCalls = upcomingCalls.filter(c => c.call_date === tomorrow);
    const dayAfterCalls = upcomingCalls.filter(c => c.call_date === dayAfter);

    // Apply search and date filters
    const baseCalls = activeTab === 'upcoming' ? upcomingCalls : historyCalls;
    const displayCalls = baseCalls.filter(c => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!(c.venture?.name || '').toLowerCase().includes(q)) return false;
        }
        if (dateFilter) {
            if (c.call_date !== dateFilter) return false;
        }
        return true;
    });

    const handleCopyLink = async (call: ScheduledCall) => {
        if (call.meet_link) {
            await navigator.clipboard.writeText(call.meet_link);
            setCopiedId(call.id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const handleCancel = async (call: ScheduledCall) => {
        if (!confirm('Are you sure you want to cancel this call?')) return;

        setCancellingId(call.id);
        try {
            await api.cancelScheduledCall(call.id);
            await fetchCalls();
        } catch (err) {
            console.error('Error cancelling call:', err);
        } finally {
            setCancellingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Row */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Scheduled Calls</h1>
                    <p className="text-gray-500 mt-1">View and manage upcoming calls.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Business Name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-56"
                        />
                    </div>
                    <div className="relative">
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-600"
                            placeholder="dd/mm/yyyy"
                        />
                    </div>
                    {dateFilter && (
                        <button
                            onClick={() => setDateFilter('')}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                            Clear date
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'upcoming'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Calendar className="w-4 h-4" />
                    Upcoming ({upcomingCalls.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Clock className="w-4 h-4" />
                    History ({historyCalls.length})
                </button>
            </div>

            {/* Summary Cards (Upcoming only) */}
            {activeTab === 'upcoming' && (
                <div className="grid grid-cols-3 gap-4">
                    <DaySummaryCard
                        title="Scheduled for Today"
                        date={formatDateShort(today)}
                        count={todayCalls.length}
                    />
                    <DaySummaryCard
                        title="Scheduled for Tomorrow"
                        date={formatDateShort(tomorrow)}
                        count={tomorrowCalls.length}
                    />
                    <DaySummaryCard
                        title="Scheduled for Day After"
                        date={formatDateShort(dayAfter)}
                        count={dayAfterCalls.length}
                    />
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs">Business Name</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs">Name</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs">Status</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs">Call With</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs">Call Date & Time</th>
                                {activeTab === 'upcoming' && (
                                    <>
                                        <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs">Copy Link</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs">Cancel</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {displayCalls.length === 0 ? (
                                <tr>
                                    <td colSpan={activeTab === 'upcoming' ? 7 : 5} className="px-4 py-8 text-center text-gray-400">
                                        {activeTab === 'upcoming' ? 'No upcoming calls' : 'No call history'}
                                    </td>
                                </tr>
                            ) : (
                                displayCalls.map((call) => {
                                    const badge = getVentureStatusBadge(call.venture);
                                    return (
                                        <tr key={call.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {call.venture?.name || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {call.venture?.founder_name || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {badge ? (
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bg} ${badge.color}`}>
                                                        {badge.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {call.panelist?.name || '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{formatDateBold(call.call_date)}</div>
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(call.start_time)} - {formatTime(call.end_time)}
                                                </div>
                                            </td>
                                            {activeTab === 'upcoming' && (
                                                <>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => handleCopyLink(call)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        >
                                                            {copiedId === call.id ? (
                                                                <>
                                                                    <Check className="w-3 h-3 text-green-600" />
                                                                    <span className="text-green-600">Copied!</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy className="w-3 h-3" />
                                                                    Copy
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => handleCancel(call)}
                                                            disabled={cancellingId === call.id}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                                        >
                                                            {cancellingId === call.id ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                <XCircle className="w-3 h-3" />
                                                            )}
                                                            Cancel
                                                        </button>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Day Summary Card with indigo left border accent
const DaySummaryCard: React.FC<{
    title: string;
    date: string;
    count: number;
}> = ({ title, date, count }) => (
    <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-indigo-500 p-5 flex items-start justify-between">
        <div>
            <div className="text-sm font-medium text-gray-700">{title}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{count}</div>
            <div className="text-xs text-gray-400 mt-0.5">{date}</div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-indigo-600" />
        </div>
    </div>
);
