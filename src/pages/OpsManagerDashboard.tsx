import React, { useEffect, useState } from 'react';
import { formatRevenue, formatEmployees } from '../utils/formatters';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
    Loader2,
    Search,
    Calendar,
    Phone,
    Users,
    ChevronDown,
    Plus,
    Link2,
    ExternalLink,
    MoreHorizontal,
    X,
    Briefcase,
    TrendingUp,
    AlertTriangle,
    HelpCircle,
    FileText,
    ChevronUp,
} from 'lucide-react';
import { ScheduleCallModal } from '../components/ScheduleCallModal';
import { AssignVPVMModal } from '../components/AssignVPVMModal';
import { STATUS_CONFIG } from '../components/StatusSelect';
import { useToast } from '../components/ui/Toast';

interface Venture {
    id: string;
    name: string;
    founder_name?: string;
    status: string;
    program_recommendation?: string;
    created_at: string;
    assigned_vsm_id?: string;
    assigned_panelist_id?: string;
    vsm_reviewed_at?: string;
    venture_partner?: string;
    city?: string;
}

interface Panelist {
    id: string;
    name: string;
    email: string;
    program: string;
}

interface CallCount {
    venture_id: string;
    total: number;
    completed: number;
    latest_meet_link?: string;
}

type ProgramFilter = string;
type CallStatusFilter = '' | 'no_calls' | 'has_calls';

function shortStatusLabel(label: string): string {
    if (label.includes('Screening')) return 'Screening';
    if (label.includes('Panel')) return 'Panel Review';
    if (label.includes('Accepted')) return 'Accepted';
    if (label.includes('Declined')) return 'Declined';
    if (label.includes('Pending')) return 'Pending';
    return label;
}

function displayProgram(rec?: string): string {
    if (!rec) return '';
    if (rec.toLowerCase().includes('prime')) return 'Accelerate Prime';
    if (rec.toLowerCase().includes('core') || rec.toLowerCase().includes('select')) return 'Accelerate Core/Select';
    if (rec.toLowerCase().includes('selfserve')) return 'Self-Serve';
    return rec;
}

function getDisplayStatus(venture: Venture): { label: string; color: string; bg: string } {
    const status = venture.status;
    const rec = venture.program_recommendation;

    if (status === 'Panel Review' && (rec || '').toLowerCase().includes('prime')) {
        return { label: 'Pending with Panel (Prime)', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    }
    if (status === 'Panel Review') {
        return { label: 'Pending with Panel (Core/Select)', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' };
    }
    if (status === 'Assign VP/VM') {
        return { label: 'Assign VP/VM', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    }
    if (status === 'With VP/VM') {
        return { label: 'With VP/VM', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    }
    if (status === 'Approved') {
        return { label: 'Accepted by Business', color: 'text-green-700', bg: 'bg-green-50 border-green-200' };
    }
    if (status === 'Rejected') {
        return { label: 'Declined by Business', color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
    }
    if (status === 'Under Review' || status === 'Submitted') {
        return { label: 'Pending with Screening Manager', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    }
    return { label: status, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
}

export const OpsManagerDashboard: React.FC = () => {
    const { toast } = useToast();
    const [ventures, setVentures] = useState<Venture[]>([]);
    const [panelists, setPanelists] = useState<Panelist[]>([]);
    const [callCounts, setCallCounts] = useState<CallCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [programFilter, setProgramFilter] = useState<ProgramFilter>('');
    const [callStatusFilter, setCallStatusFilter] = useState<CallStatusFilter>('');
    const [scheduleModalVenture, setScheduleModalVenture] = useState<Venture | null>(null);
    const [assignVPVMVenture, setAssignVPVMVenture] = useState<Venture | null>(null);
    const [profileVenture, setProfileVenture] = useState<any | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const openVentureProfile = async (venture: Venture) => {
        setProfileLoading(true);
        setProfileVenture({ name: venture.name || 'Unknown Venture', founder_name: venture.founder_name || '', needs: [] });
        try {
            const { venture: full, streams } = await api.getVenture(venture.id);
            const mappedNeeds = (streams || []).map((s: any) => ({
                id: s.id,
                stream: s.stream_name || '',
                status: s.status || 'N/A'
            }));
            setProfileVenture({ ...(full || {}), needs: mappedNeeds });
        } catch (err) {
            console.error('Error fetching venture profile:', err);
        } finally {
            setProfileLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch ventures with assessments
            const { data: ventureData } = await supabase
                .from('ventures')
                .select('*, assessments:venture_assessments(*)')
                .in('status', ['Panel Review', 'Approved', 'Assign VP/VM', 'With VP/VM', 'Rejected', 'Under Review', 'Submitted']);

            const flatVentures: Venture[] = (ventureData || []).map((v: any) => {
                const assessment = (v.assessments || []).find((a: any) => a.is_current) || v.assessments?.[0] || {};
                return {
                    ...v,
                    program_recommendation: assessment.program_recommendation,
                    vsm_reviewed_at: assessment.assessment_date,
                };
            });

            setVentures(flatVentures);

            // Fetch panelists
            const { data: panelistData } = await supabase
                .from('panelists')
                .select('*')
                .order('name');
            setPanelists(panelistData || []);

            // Fetch scheduled call counts grouped by venture_id (exclude cancelled)
            const { data: callData } = await supabase
                .from('scheduled_calls')
                .select('venture_id, status, meet_link, created_at')
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false });

            const counts: Record<string, CallCount> = {};
            (callData || []).forEach((c: any) => {
                if (!counts[c.venture_id]) {
                    counts[c.venture_id] = { venture_id: c.venture_id, total: 0, completed: 0, latest_meet_link: c.meet_link };
                }
                counts[c.venture_id].total++;
                if (c.status === 'completed') counts[c.venture_id].completed++;
            });
            setCallCounts(Object.values(counts));
        } catch (err) {
            console.error('Error fetching ops data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const getCallCount = (ventureId: string) => {
        return callCounts.find(c => c.venture_id === ventureId) || { total: 0, completed: 0, latest_meet_link: undefined };
    };

    // Derive unique display status values from data
    const uniqueStatuses = Array.from(
        new Set(ventures.map(v => shortStatusLabel(getDisplayStatus(v).label)))
    ).filter(s => s !== 'Draft').sort();

    // Filter ventures
    const committeeVentures = ventures.filter(v => v.status === 'Panel Review');
    const filteredVentures = ventures.filter(v => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!v.name.toLowerCase().includes(q) && !(v.founder_name || '').toLowerCase().includes(q)) return false;
        }
        if (programFilter) {
            if (shortStatusLabel(getDisplayStatus(v).label) !== programFilter) return false;
        }
        if (callStatusFilter === 'no_calls') {
            if (getCallCount(v.id).total > 0) return false;
        }
        if (callStatusFilter === 'has_calls') {
            if (getCallCount(v.id).total === 0) return false;
        }
        return true;
    });

    // Summary card stats
    const pendingWithPanel = committeeVentures.length;
    const noCallsScheduled = committeeVentures.filter(v => getCallCount(v.id).total === 0).length;
    const hasCallsScheduled = committeeVentures.filter(v => getCallCount(v.id).total > 0).length;

    const getProgramBreakdown = (ventureList: Venture[]) => {
        const prime = ventureList.filter(v => (v.program_recommendation || '').includes('Prime')).length;
        const coreSelect = ventureList.filter(v => {
            const rec = (v.program_recommendation || '').toLowerCase();
            return rec.includes('core') || rec.includes('select');
        }).length;
        return { prime, coreSelect };
    };

    const pendingBreakdown = getProgramBreakdown(committeeVentures);
    const noCallsBreakdown = getProgramBreakdown(committeeVentures.filter(v => getCallCount(v.id).total === 0));
    const hasCallsBreakdown = getProgramBreakdown(committeeVentures.filter(v => getCallCount(v.id).total > 0));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
                <p className="text-gray-500 mt-1">Ventures recommended to panel by screening manager</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
                <SummaryCard
                    title="Pending with Panel"
                    count={pendingWithPanel}
                    breakdown={pendingBreakdown}
                    icon={<Users className="w-5 h-5 text-indigo-600" />}
                    color="indigo"
                />
                <SummaryCard
                    title="No Calls Scheduled"
                    count={noCallsScheduled}
                    breakdown={noCallsBreakdown}
                    icon={<Calendar className="w-5 h-5 text-amber-600" />}
                    color="amber"
                />
                <SummaryCard
                    title="At Least 1 Call Scheduled"
                    count={hasCallsScheduled}
                    breakdown={hasCallsBreakdown}
                    icon={<Phone className="w-5 h-5 text-green-600" />}
                    color="green"
                />
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search ventures..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                </div>
                <div className="relative">
                    <select
                        value={programFilter}
                        onChange={(e) => setProgramFilter(e.target.value as ProgramFilter)}
                        className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="">All Status</option>
                        {uniqueStatuses.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <div className="relative">
                    <select
                        value={callStatusFilter}
                        onChange={(e) => setCallStatusFilter(e.target.value as CallStatusFilter)}
                        className="appearance-none pl-4 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                        <option value="">All Call Status</option>
                        <option value="no_calls">No Calls Scheduled</option>
                        <option value="has_calls">Has Calls Scheduled</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 font-medium text-gray-500">Business Name</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500">Program</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500">Assigned To</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500">SC Program Rec. Date</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500">Calls Scheduled (Completed)</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500">Link</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVentures.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center">
                                        {ventures.length === 0 ? (
                                            <div className="space-y-2">
                                                <Users className="w-8 h-8 text-gray-300 mx-auto" />
                                                <p className="text-gray-500 font-medium">No ventures available</p>
                                                <p className="text-gray-400 text-xs">There are no ventures in the system yet.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Search className="w-8 h-8 text-gray-300 mx-auto" />
                                                <p className="text-gray-500 font-medium">No ventures match your filters</p>
                                                <p className="text-gray-400 text-xs">Try adjusting your search or filter criteria.</p>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredVentures.map((venture) => {
                                    const displayStatus = getDisplayStatus(venture);
                                    const cc = getCallCount(venture.id);
                                    const assignedPanelist = venture.assigned_panelist_id
                                        ? panelists.find(p => p.id === venture.assigned_panelist_id)
                                        : null;

                                    return (
                                        <tr key={venture.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => openVentureProfile(venture)}
                                                    className="text-left group"
                                                >
                                                    <div className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{venture.name}</div>
                                                    <div className="text-xs text-gray-400">{venture.founder_name || '-'}</div>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                {venture.program_recommendation ? (
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${
                                                        (venture.program_recommendation || '').toLowerCase().includes('prime')
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                    }`}>
                                                        {(venture.program_recommendation || '').toLowerCase().includes('prime') ? 'Prime' : 'Core/Select'}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {(() => {
                                                    const label = displayStatus.label;
                                                    let short = label;
                                                    let style = 'bg-gray-50 text-gray-600 border-gray-200';
                                                    if (label === 'Assign VP/VM') { short = 'Assign VP/VM'; style = 'bg-purple-50 text-purple-700 border-purple-200'; }
                                                    else if (label === 'With VP/VM') { short = 'With VP/VM'; style = 'bg-purple-50 text-purple-700 border-purple-200'; }
                                                    else if (label.includes('Screening')) { short = 'Screening'; style = 'bg-amber-50 text-amber-700 border-amber-200'; }
                                                    else if (label.includes('Panel')) { short = label.includes('Prime') ? 'Panel Review' : 'Panel Review'; style = 'bg-indigo-50 text-indigo-700 border-indigo-200'; }
                                                    else if (label.includes('Accepted')) { short = 'Accepted'; style = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
                                                    else if (label.includes('Declined')) { short = 'Declined'; style = 'bg-red-50 text-red-700 border-red-200'; }
                                                    else if (label.includes('Pending')) { short = 'Pending'; style = 'bg-blue-50 text-blue-700 border-blue-200'; }
                                                    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${style}`}>{short}</span>;
                                                })()}
                                            </td>
                                            <td className="px-4 py-3">
                                                {venture.venture_partner ? (
                                                    <span className="text-sm text-gray-700 font-medium whitespace-nowrap">{venture.venture_partner}</span>
                                                ) : assignedPanelist?.name ? (
                                                    <span className="text-sm text-gray-700 font-medium whitespace-nowrap">{assignedPanelist.name}</span>
                                                ) : (
                                                    <span className="text-xs text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {venture.vsm_reviewed_at
                                                    ? new Date(venture.vsm_reviewed_at).toLocaleDateString()
                                                    : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-gray-900 font-medium">{cc.total}({cc.completed})</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {cc.latest_meet_link ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <a
                                                            href={cc.latest_meet_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title="Join meeting"
                                                            className="inline-flex items-center justify-center text-indigo-600 hover:text-indigo-700 transition-colors"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(cc.latest_meet_link!);
                                                            }}
                                                            title="Copy meet link"
                                                            className="inline-flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <Link2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {venture.status === 'Assign VP/VM' ? (
                                                    <button
                                                        onClick={() => setAssignVPVMVenture(venture)}
                                                        className="inline-flex items-center gap-1 text-indigo-600 text-sm font-medium hover:text-indigo-700 transition-colors"
                                                    >
                                                        <Users className="w-3.5 h-3.5" />
                                                        Assign VP/VM
                                                    </button>
                                                ) : venture.status === 'With VP/VM' ? (
                                                    <button
                                                        onClick={() => setScheduleModalVenture(venture)}
                                                        className="inline-flex items-center gap-1 text-indigo-600 text-sm font-medium hover:text-indigo-700 transition-colors"
                                                    >
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Schedule Call
                                                    </button>
                                                ) : cc.total > 0 ? (
                                                    <button
                                                        onClick={() => setScheduleModalVenture(venture)}
                                                        className="inline-flex items-center gap-1 text-indigo-600 text-sm font-medium hover:text-indigo-700 transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Schedule Another
                                                    </button>
                                                ) : venture.status === 'Panel Review' ? (
                                                    <button
                                                        onClick={() => setScheduleModalVenture(venture)}
                                                        className="inline-flex items-center gap-1 text-indigo-600 text-sm font-medium hover:text-indigo-700 transition-colors"
                                                    >
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Schedule Call
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-300">
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Schedule Call Modal */}
            {scheduleModalVenture && (
                <ScheduleCallModal
                    venture={scheduleModalVenture}
                    panelists={scheduleModalVenture.assigned_panelist_id
                        ? panelists.filter(p => p.id === scheduleModalVenture.assigned_panelist_id)
                        : scheduleModalVenture.program_recommendation
                            ? panelists.filter(p => p.program && scheduleModalVenture.program_recommendation?.includes(p.program))
                            : panelists
                    }
                    onClose={() => setScheduleModalVenture(null)}
                    onScheduled={() => {
                        setScheduleModalVenture(null);
                        fetchData();
                    }}
                />
            )}

            {/* Assign VP/VM Modal */}
            {assignVPVMVenture && (
                <AssignVPVMModal
                    venture={assignVPVMVenture}
                    onClose={() => setAssignVPVMVenture(null)}
                    onAssigned={() => {
                        setAssignVPVMVenture(null);
                        fetchData();
                    }}
                />
            )}

            {/* Venture Profile Drawer (Panel-style) */}
            {profileVenture && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
                        onClick={() => setProfileVenture(null)}
                    />
                    <div className="fixed inset-4 z-50 mx-auto max-w-5xl bg-white shadow-2xl overflow-y-auto rounded-2xl">
                        {/* Drawer Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{profileVenture.name || 'Unknown Venture'}</h2>
                                {profileVenture.program_recommendation && (
                                    <span className="inline-flex items-center px-3 py-1 mt-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                                        {displayProgram(profileVenture.program_recommendation)}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setProfileVenture(null)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {profileLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            </div>
                        ) : (
                            <div className="p-6 space-y-6">
                                {/* Screening Manager Assessment Banner */}
                                {profileVenture.program_recommendation && (
                                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-indigo-900">Screening Manager Assessment</p>
                                            <p className="text-xs text-indigo-700 mt-1">
                                                This venture was assessed and recommended for {displayProgram(profileVenture.program_recommendation)}.
                                                {profileVenture.vsm_reviewed_at && ` Reviewed on ${new Date(profileVenture.vsm_reviewed_at).toLocaleDateString()}.`}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Key Metrics */}
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Revenue</span>
                                        <div className="text-lg font-bold text-gray-900">{formatRevenue(profileVenture.revenue_12m)}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Incremental Revenue (3Y)</span>
                                        <div className="text-lg font-bold text-gray-900">{formatRevenue(profileVenture.revenue_potential_3y)}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Employees</span>
                                        <div className="text-lg font-bold text-gray-900 flex items-center gap-1">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            {(() => { const emp = formatEmployees(profileVenture.full_time_employees); return <>{emp.total}{emp.breakdown && <span className="text-xs text-gray-400 block">{emp.breakdown}</span>}</>; })()}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Jobs</span>
                                        <div className="text-lg font-bold text-gray-900 flex items-center gap-1">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            {profileVenture.target_jobs ?? 'N/A'}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Financial Condition</span>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {profileVenture.financial_condition || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Owner Involvement</span>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {profileVenture.time_commitment || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Leadership Team</span>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {profileVenture.second_line_team || 'N/A'}
                                        </div>
                                    </div>
                                </div>

                                {/* Founder / Company Info */}
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">Name: <span className="font-semibold text-gray-900">{profileVenture.founder_name || 'N/A'}</span></span>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">Mobile: <span className="font-semibold text-gray-900">{profileVenture.founder_phone || 'N/A'}</span></span>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">Email: <span className="font-semibold text-gray-900">{profileVenture.founder_email || 'N/A'}</span></span>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">Registered company name</span>
                                            <div className="font-medium text-gray-900">{profileVenture.name || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">Designation</span>
                                            <div className="font-medium text-gray-900">{profileVenture.founder_designation || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">Company type</span>
                                            <div className="font-medium text-gray-900">{profileVenture.company_type || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">City</span>
                                            <div className="font-medium text-gray-900">{profileVenture.city || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">State</span>
                                            <div className="font-medium text-gray-900">{profileVenture.state || 'N/A'}</div>
                                        </div>
                                        <div>
                                            <span className="text-sm text-gray-600 block mb-1">How did I hear about us</span>
                                            <div className="font-medium text-gray-900">{profileVenture.referred_by || 'N/A'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Current Business vs New Venture */}
                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    {/* Header Row */}
                                    <div className="grid grid-cols-2 divide-x divide-gray-100">
                                        <div className="p-5 pb-3">
                                            <div className="flex items-center gap-2 text-gray-900 font-bold border-b border-gray-100 pb-3">
                                                <Briefcase className="w-4 h-4 text-gray-400" />
                                                Current Business
                                            </div>
                                        </div>
                                        <div className="p-5 pb-3 bg-white">
                                            <div className="flex items-center gap-2 text-blue-900 font-bold border-b border-blue-100 pb-3">
                                                <TrendingUp className="w-4 h-4 text-blue-600" />
                                                New Venture
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row 1: Product */}
                                    <div className="grid grid-cols-2 divide-x divide-gray-100">
                                        <div className="px-5 py-3">
                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Product / Service</span>
                                            <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[40px] flex items-center">{profileVenture.what_do_you_sell || 'N/A'}</p>
                                        </div>
                                        <div className="px-5 py-3 bg-white">
                                            <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Product</span>
                                            <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[40px] flex items-center shadow-sm shadow-blue-100/50">{profileVenture.focus_product || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Row 2: Segment */}
                                    <div className="grid grid-cols-2 divide-x divide-gray-100">
                                        <div className="px-5 py-3">
                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Customer Segment</span>
                                            <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[40px] flex items-center">{profileVenture.who_do_you_sell_to || 'N/A'}</p>
                                        </div>
                                        <div className="px-5 py-3 bg-white">
                                            <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Segment</span>
                                            <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[40px] flex items-center shadow-sm shadow-blue-100/50">{profileVenture.focus_segment || 'N/A'}</p>
                                        </div>
                                    </div>

                                    {/* Row 3: Region */}
                                    <div className="grid grid-cols-2 divide-x divide-gray-100">
                                        <div className="px-5 py-3 pb-5">
                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Region</span>
                                            <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[40px] flex items-center">{profileVenture.which_regions || 'N/A'}</p>
                                        </div>
                                        <div className="px-5 py-3 pb-5 bg-white">
                                            <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Region</span>
                                            <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[40px] flex items-center shadow-sm shadow-blue-100/50">{profileVenture.focus_geography || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Growth Idea Support Status */}
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 mb-3">Growth Idea Support Status</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['Product', 'Go-To-Market (GTM)', 'Capital Planning'].map(stream => {
                                            const rawStatus = (profileVenture.needs || []).find((n: any) =>
                                                n.stream === stream ||
                                                (stream === 'Go-To-Market (GTM)' && n.stream === 'GTM') ||
                                                (stream === 'Capital Planning' && n.stream === 'Funding')
                                            )?.status || 'N/A';
                                            const legacyMapping: Record<string, string> = {
                                                'Not started': 'Need some guidance', 'Working on it': 'Need some guidance',
                                                'On track': "Don't need help", 'Need some advice': 'Need some guidance',
                                                'Need guidance': 'Need some guidance', 'Completed': "Don't need help",
                                                'Done': "Don't need help", 'No help needed': "Don't need help"
                                            };
                                            const mappedStatus = legacyMapping[rawStatus] || rawStatus;
                                            const normalizedStatus = Object.keys(STATUS_CONFIG).find(
                                                key => key.toLowerCase() === mappedStatus?.toLowerCase()
                                            ) || mappedStatus;
                                            const config = STATUS_CONFIG[normalizedStatus] || { icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' };
                                            const Icon = config.icon;
                                            return (
                                                <div key={stream}>
                                                    <span className="text-xs font-semibold text-gray-900 block mb-1.5">{stream}</span>
                                                    <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border ${config.bg} ${config.border} ${config.color}`}>
                                                        <Icon className="w-3.5 h-3.5" />
                                                        {normalizedStatus}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 mt-3">
                                        {['Supply Chain', 'Operations', 'Team'].map(stream => {
                                            const rawStatus = (profileVenture.needs || []).find((n: any) =>
                                                n.stream === stream ||
                                                (stream === 'Supply Chain' && n.stream === 'SupplyChain')
                                            )?.status || 'N/A';
                                            const legacyMapping: Record<string, string> = {
                                                'Not started': 'Need some guidance', 'Working on it': 'Need some guidance',
                                                'On track': "Don't need help", 'Need some advice': 'Need some guidance',
                                                'Need guidance': 'Need some guidance', 'Completed': "Don't need help",
                                                'Done': "Don't need help", 'No help needed': "Don't need help"
                                            };
                                            const mappedStatus = legacyMapping[rawStatus] || rawStatus;
                                            const normalizedStatus = Object.keys(STATUS_CONFIG).find(
                                                key => key.toLowerCase() === mappedStatus?.toLowerCase()
                                            ) || mappedStatus;
                                            const config = STATUS_CONFIG[normalizedStatus] || { icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200' };
                                            const Icon = config.icon;
                                            return (
                                                <div key={stream}>
                                                    <span className="text-xs font-semibold text-gray-900 block mb-1.5">{stream}</span>
                                                    <div className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border ${config.bg} ${config.border} ${config.color}`}>
                                                        <Icon className="w-3.5 h-3.5" />
                                                        {normalizedStatus}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Company Document */}
                                <div>
                                    <h3 className="text-base font-bold text-gray-900 mb-3">Company Document</h3>
                                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                                        {profileVenture.corporate_presentation_url ? (
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                    <FileText className="w-5 h-5 text-blue-600" />
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {profileVenture.corporate_presentation_url.split('/').pop()?.replace(/^\d+_/, '') || 'Corporate Presentation'}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const url = await api.getVentureDocumentUrl(profileVenture.corporate_presentation_url);
                                                            window.open(url, '_blank');
                                                        } catch (err) {
                                                            console.error('Failed to get document URL:', err);
                                                            toast('Failed to download document. Please try again.', 'error');
                                                        }
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-semibold"
                                                >
                                                    Download
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">
                                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                <div>
                                                    <p className="text-sm font-medium text-gray-700">No document uploaded</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">The venture did not upload a corporate presentation</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Other Support Details */}
                                <OtherDetailsSection profileVenture={profileVenture} />

                                {/* Program Recommendation */}
                                {profileVenture.program_recommendation && (
                                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Briefcase className="w-5 h-5 text-gray-400" />
                                            <span className="text-base font-bold text-gray-700">Program Recommendation</span>
                                        </div>
                                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-indigo-700">Recommended Program:</span>
                                                <span className="text-lg font-bold text-indigo-900">{displayProgram(profileVenture.program_recommendation)}</span>
                                            </div>
                                            {profileVenture.internal_comments && (
                                                <div className="mt-3 pt-3 border-t border-indigo-200">
                                                    <span className="text-xs font-bold text-indigo-600 uppercase block mb-2">Internal Comments</span>
                                                    <p className="text-sm text-indigo-800 whitespace-pre-wrap">{profileVenture.internal_comments}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Screening SCALE Scorecard */}
                                {profileVenture.ai_analysis?.scorecard && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                                            <span className="text-base font-bold text-gray-700">Screening SCALE Scorecard</span>
                                            <span className="text-xs text-gray-400">Read Only</span>
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-200 bg-gray-50">
                                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Dimension</th>
                                                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-500 uppercase">Rating</th>
                                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Brief</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {profileVenture.ai_analysis.scorecard.map((item: any, i: number) => {
                                                    const style = item.rating === 'Green' ? { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' } : item.rating === 'Red' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' } : { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
                                                    return (
                                                        <tr key={i} className={style.bg}>
                                                            <td className="px-4 py-3 font-semibold text-gray-800">{item.dimension}</td>
                                                            <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 ${style.text} font-semibold text-xs`}><span className={`w-2 h-2 rounded-full ${style.dot}`}/>{item.rating}</span></td>
                                                            <td className="px-4 py-3 text-gray-600 text-xs">{item.brief}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Panel SCALE Scorecard */}
                                {profileVenture.panel_ai_analysis?.panel_scorecard && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                                            <span className="text-base font-bold text-gray-700">Panel SCALE Scorecard</span>
                                            <span className="text-xs text-gray-400">Read Only</span>
                                        </div>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-200 bg-gray-50">
                                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Dimension</th>
                                                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-500 uppercase">App Rating</th>
                                                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-500 uppercase">Panel Rating</th>
                                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Brief</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {profileVenture.panel_ai_analysis.panel_scorecard.map((item: any, i: number) => {
                                                    const rs = (r: string) => r === 'Green' ? 'text-green-700' : r === 'Red' ? 'text-red-700' : 'text-amber-700';
                                                    const ds = (r: string) => r === 'Green' ? 'bg-green-500' : r === 'Red' ? 'bg-red-500' : 'bg-amber-500';
                                                    return (
                                                        <tr key={i}>
                                                            <td className="px-4 py-3 font-semibold text-gray-800">{item.dimension}</td>
                                                            <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 text-xs font-semibold ${rs(item.application_rating || item.rating || '')}`}><span className={`w-1.5 h-1.5 rounded-full ${ds(item.application_rating || item.rating || '')}`}/>{item.application_rating || item.rating || '-'}</span></td>
                                                            <td className="px-3 py-3 text-center">{item.panel_rating ? <span className={`inline-flex items-center gap-1 text-xs font-semibold ${rs(item.panel_rating)}`}><span className={`w-1.5 h-1.5 rounded-full ${ds(item.panel_rating)}`}/>{item.panel_rating}</span> : '-'}</td>
                                                            <td className="px-4 py-3 text-gray-600 text-xs">{item.panel_brief || item.brief || '-'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Panel Gate Questions */}
                                {profileVenture.gate_questions?.gate_questions && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                                            <span className="text-base font-bold text-gray-700">Panel Gate Questions</span>
                                            <span className="text-xs text-gray-400">Read Only</span>
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {profileVenture.gate_questions.gate_questions.map((gq: any, i: number) => (
                                                <div key={i} className="px-5 py-3 flex items-start gap-3">
                                                    <span className="text-xs font-bold text-gray-400 mt-0.5">{i + 1}.</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-gray-800">{gq.question}</p>
                                                        {gq.remarks && <p className="text-xs text-gray-500 mt-1">{gq.remarks}</p>}
                                                    </div>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(gq.response || gq.answer) === 'Yes' ? 'bg-green-100 text-green-700' : (gq.response || gq.answer) === 'No' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {gq.response || gq.answer || '—'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

// Other Details Section for Profile Drawer
const OtherDetailsSection: React.FC<{ profileVenture: any }> = ({ profileVenture }) => {
    const [open, setOpen] = useState(true);
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition-colors"
            >
                <span className="text-base font-bold text-gray-700">Other support details</span>
                <div className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 transition-colors">
                    {open ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
            </button>
            {open && (
                <div className="px-5 pb-5 space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                            Support Description (from application)
                        </label>
                        <div className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                            {profileVenture.support_request || 'No support description provided'}
                        </div>
                    </div>
                    {profileVenture.vsm_notes && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                                Screening Manager Notes
                            </label>
                            <div className="w-full min-h-[80px] rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                                {profileVenture.vsm_notes}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Summary Card Component
const SummaryCard: React.FC<{
    title: string;
    count: number;
    breakdown: { prime: number; coreSelect: number };
    icon: React.ReactNode;
    color: string;
}> = ({ title, count, breakdown, icon, color }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg bg-${color}-50 flex items-center justify-center`}>
                {icon}
            </div>
            <span className="text-2xl font-bold text-gray-900">{count}</span>
        </div>
        <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Prime: {breakdown.prime}</span>
            <span>Core/Select: {breakdown.coreSelect}</span>
        </div>
    </div>
);
