import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import {
    Loader2, Search, FileText, Clock, Users, Building2, Download,
    ChevronUp, ChevronDown, UserPlus, X, Briefcase, TrendingUp, AlertTriangle, HelpCircle, Sparkles, Target,
} from 'lucide-react';
import { STATUS_CONFIG } from '../components/StatusSelect';
import { useToast } from '../components/ui/Toast';

// ─── Types ───────────────────────────────────────────────────────────
interface Venture {
    id: string;
    name: string;
    founder_name?: string;
    status: string;
    program_recommendation?: string;
    created_at: string;
    assigned_vsm_id?: string;
    assigned_panelist_id?: string;
    agreement_status?: string;
}

interface StaffUser {
    id: string;
    full_name: string;
    email: string;
    role: string;
    created_at: string;
}

interface PerformanceRow {
    id: string;
    name: string;
    role: string;
    roleLabel: string;
    pendingReviews: number;
    completedReviews: number;
    approved: number;
    rejected: number;
    avgTurnaroundDays: number;
}

export type AdminTab = 'applications' | 'performance' | 'users';
type SortField = 'name' | 'created_at' | 'status' | 'program_recommendation' | 'assigned_to' | 'total_aging' | 'status_aging';
type SortDir = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────
function getDisplayStatus(v: Venture): string {
    const s = v.status;
    const rec = (v.program_recommendation || '').toLowerCase();
    if (s === 'Panel Review' && rec.includes('prime')) return 'Pending with Panel (Prime)';
    if (s === 'Panel Review') return 'Pending with Panel (Core/Select)';
    if (s === 'Contract Sent' || s === 'Agreement Sent') return 'Pending with Business';
    if (s === 'Joined Program' || (s === 'Approved' && v.agreement_status?.toLowerCase() === 'signed')) return 'Accepted by Business';
    if (s === 'Rejected') return 'Declined by Business';
    if (s === 'Under Review' || s === 'Submitted') return 'Pending with Screening Manager';
    return s;
}

function shortProgramName(rec?: string): string {
    if (!rec) return '';
    const lower = rec.toLowerCase();
    if (lower.includes('prime')) return 'Prime';
    if (lower.includes('core') || lower.includes('select')) return 'Core/Select';
    if (lower.includes('selfserve')) return 'Selfserve';
    return rec;
}

function displayProgram(rec?: string): string {
    if (!rec) return '';
    if (rec.toLowerCase().includes('prime')) return 'Accelerate Prime';
    if (rec.toLowerCase().includes('core') || rec.toLowerCase().includes('select')) return 'Accelerate Core/Select';
    if (rec.toLowerCase().includes('selfserve')) return 'Self-Serve';
    return rec;
}

function shortStatusLabel(label: string): string {
    if (label === 'Pending with Screening Manager') return 'Screening';
    if (label.startsWith('Pending with Panel')) return 'Panel Review';
    if (label === 'Accepted by Business') return 'Accepted';
    if (label === 'Declined by Business') return 'Declined';
    if (label === 'Pending with Business') return 'Pending';
    return label;
}

function getStatusBadge(label: string) {
    let style = { color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' };
    if (label === 'Screening') style = { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    else if (label === 'Panel Review') style = { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' };
    else if (label === 'Pending') style = { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
    else if (label === 'Accepted') style = { color: 'text-green-700', bg: 'bg-green-50 border-green-200' };
    else if (label === 'Declined') style = { color: 'text-red-700', bg: 'bg-red-50 border-red-200' };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap ${style.bg} ${style.color}`}>{label}</span>;
}

function daysSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function roleLabel(role: string): string {
    const m: Record<string, string> = {
        success_mgr: 'Screening Manager',
        venture_mgr: 'Panel (Prime)',
        committee_member: 'Panel (Core/Select)',
        ops_manager: 'Ops Manager',
        admin: 'Admin',
    };
    return m[role] || role;
}

// ─── Main Component ──────────────────────────────────────────────────
interface AdminDashboardProps {
    tab?: AdminTab;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ tab = 'applications' }) => {
    const { toast } = useToast();
    const [ventures, setVentures] = useState<Venture[]>([]);
    const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
    const [profiles, setProfiles] = useState<Record<string, { full_name: string; role: string }>>({});
    const [statusHistory, setStatusHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Application filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Performance filters
    const [perfSearch, setPerfSearch] = useState('');
    const [perfRoleFilter, setPerfRoleFilter] = useState('');

    // User filters
    const [userSearch, setUserSearch] = useState('');

    // Timeline drawer
    const [timelineVenture, setTimelineVenture] = useState<Venture | null>(null);

    // Venture profile drawer
    const [profileVenture, setProfileVenture] = useState<any | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    // Add user modal
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('success_mgr');
    const [addingUser, setAddingUser] = useState(false);
    const [addUserError, setAddUserError] = useState('');

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

    // ─── Fetch Data ──────────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            // Ventures with assessments
            const { data: ventureData } = await supabase
                .from('ventures')
                .select('*, assessments:venture_assessments(*)');

            const flat: Venture[] = (ventureData || []).map((v: any) => {
                const assessment = (v.assessments || []).find((a: any) => a.is_current) || v.assessments?.[0] || {};
                return { ...v, program_recommendation: assessment.program_recommendation };
            });
            setVentures(flat);

            // Profiles (all staff)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, role');
            const profileMap: Record<string, { full_name: string; role: string }> = {};
            (profileData || []).forEach((p: any) => { profileMap[p.id] = p; });

            // Panelists (assigned_panelist_id references panelists table, not profiles)
            const { data: panelistData } = await supabase
                .from('panelists')
                .select('id, name, program');
            (panelistData || []).forEach((p: any) => {
                if (!profileMap[p.id]) {
                    profileMap[p.id] = { full_name: p.name, role: p.program === 'Prime' ? 'venture_mgr' : 'committee_member' };
                }
            });
            setProfiles(profileMap);

            // Staff users for Users tab
            const staffList: StaffUser[] = (profileData || [])
                .filter((p: any) => p.role && p.role !== 'entrepreneur')
                .map((p: any) => ({ id: p.id, full_name: p.full_name || '', email: '', role: p.role, created_at: '' }));
            setStaffUsers(staffList);

            // Status history for aging
            const { data: historyData } = await supabase
                .from('venture_status_history')
                .select('venture_id, previous_value, new_value, created_at, changed_by, changed_by_role')
                .order('created_at', { ascending: false });
            setStatusHistory(historyData || []);
        } catch (err) {
            console.error('Admin fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch emails for staff users
    const fetchStaffEmails = async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) return;
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setStaffUsers(data.users || []);
            }
        } catch (err) {
            console.error('Error fetching staff emails:', err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchStaffEmails();
    }, []);

    // ─── Helpers for program matching (handles "Accelerate Prime" / "Prime" etc.) ──
    const isPrime = (rec?: string) => !!rec && rec.toLowerCase().includes('prime');
    const isCore = (rec?: string) => !!rec && rec.toLowerCase().includes('core');
    const isSelect = (rec?: string) => !!rec && rec.toLowerCase().includes('select');
    const isSelfserve = (rec?: string) => !!rec && rec.toLowerCase().includes('selfserve');
    const isJoined = (v: Venture) => v.status === 'Joined Program' || (v.status === 'Approved' && v.agreement_status?.toLowerCase() === 'signed');
    const panelApprovedStatuses = ['Approved', 'Contract Sent', 'Agreement Sent', 'Joined Program'];

    // ─── Computed Stats ──────────────────────────────────────────────
    const totalApplications = ventures.length;
    const pendingScreening = ventures.filter(v => ['Submitted', 'Under Review'].includes(v.status)).length;
    const pendingPanel = ventures.filter(v => v.status === 'Panel Review').length;
    const pendingPanelPrime = ventures.filter(v => v.status === 'Panel Review' && isPrime(v.program_recommendation)).length;
    const pendingPanelCore = ventures.filter(v => v.status === 'Panel Review' && isCore(v.program_recommendation)).length;
    const pendingPanelSelect = ventures.filter(v => v.status === 'Panel Review' && isSelect(v.program_recommendation)).length;

    const withBusiness = ventures.filter(v => ['Contract Sent', 'Agreement Sent', 'Joined Program', 'Approved', 'Rejected'].includes(v.status)).length;
    const pendingBusiness = ventures.filter(v => ['Contract Sent', 'Agreement Sent'].includes(v.status)).length;
    const joinedProgram = ventures.filter(v => isJoined(v)).length;
    const declinedBusiness = ventures.filter(v => v.status === 'Rejected').length;

    const joinedPrime = ventures.filter(v => isJoined(v) && isPrime(v.program_recommendation)).length;
    const joinedCore = ventures.filter(v => isJoined(v) && isCore(v.program_recommendation)).length;
    const joinedSelect = ventures.filter(v => isJoined(v) && isSelect(v.program_recommendation)).length;
    const joinedSelfserve = ventures.filter(v => isJoined(v) && isSelfserve(v.program_recommendation)).length;

    // Panel received = ventures that have a program recommendation
    const panelVentures = ventures.filter(v => v.program_recommendation);
    const panelReceivedPrime = panelVentures.filter(v => isPrime(v.program_recommendation)).length;
    const panelReceivedCore = panelVentures.filter(v => isCore(v.program_recommendation)).length;
    const panelReceivedSelect = panelVentures.filter(v => isSelect(v.program_recommendation)).length;
    const panelApprovedPrime = panelVentures.filter(v => isPrime(v.program_recommendation) && panelApprovedStatuses.includes(v.status)).length;
    const panelApprovedCore = panelVentures.filter(v => isCore(v.program_recommendation) && panelApprovedStatuses.includes(v.status)).length;
    const panelApprovedSelect = panelVentures.filter(v => isSelect(v.program_recommendation) && panelApprovedStatuses.includes(v.status)).length;
    const panelRejectedPrime = panelVentures.filter(v => isPrime(v.program_recommendation) && v.status === 'Rejected').length;
    const panelRejectedCore = panelVentures.filter(v => isCore(v.program_recommendation) && v.status === 'Rejected').length;
    const panelRejectedSelect = panelVentures.filter(v => isSelect(v.program_recommendation) && v.status === 'Rejected').length;

    // ─── Status Aging ────────────────────────────────────────────────
    function getStatusAging(ventureId: string): number {
        const latest = statusHistory.find(h => h.venture_id === ventureId);
        if (latest) return daysSince(latest.created_at);
        const v = ventures.find(x => x.id === ventureId);
        return v ? daysSince(v.created_at) : 0;
    }

    // ─── Applications Table ──────────────────────────────────────────
    const uniqueStatuses = Array.from(new Set(ventures.map(v => shortStatusLabel(getDisplayStatus(v))))).filter(s => s !== 'Draft').sort();

    const filteredVentures = ventures
        .filter(v => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!v.name.toLowerCase().includes(q) && !(v.founder_name || '').toLowerCase().includes(q)) return false;
            }
            if (statusFilter && shortStatusLabel(getDisplayStatus(v)) !== statusFilter) return false;
            return true;
        })
        .sort((a, b) => {
            let av: any, bv: any;
            switch (sortField) {
                case 'name': av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
                case 'created_at': av = a.created_at; bv = b.created_at; break;
                case 'status': av = getDisplayStatus(a); bv = getDisplayStatus(b); break;
                case 'program_recommendation': av = a.program_recommendation || ''; bv = b.program_recommendation || ''; break;
                case 'total_aging': av = daysSince(a.created_at); bv = daysSince(b.created_at); break;
                case 'status_aging': av = getStatusAging(a.id); bv = getStatusAging(b.id); break;
                default: av = a.created_at; bv = b.created_at;
            }
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const SortIcon = ({ field }: { field: SortField }) => (
        sortField === field
            ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
            : <ChevronDown className="w-3 h-3 opacity-30" />
    );

    // ─── Export CSV ──────────────────────────────────────────────────
    const exportCSV = () => {
        const headers = ['Business Name', 'Submitted Date', 'Status', 'Program', 'Assigned To', 'Total Aging (days)', 'Status Aging (days)'];
        const rows = filteredVentures.map(v => [
            v.name,
            new Date(v.created_at).toLocaleDateString(),
            getDisplayStatus(v),
            v.program_recommendation || '-',
            profiles[v.assigned_vsm_id || '']?.full_name || profiles[v.assigned_panelist_id || '']?.full_name || '-',
            daysSince(v.created_at),
            getStatusAging(v.id),
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    };

    // ─── Performance Data ────────────────────────────────────────────
    const performanceData: PerformanceRow[] = Object.values(profiles)
        .filter(p => ['success_mgr', 'venture_mgr', 'committee_member'].includes(p.role))
        .map(p => {
            const pid = Object.keys(profiles).find(k => profiles[k] === p) || '';
            const assigned = ventures.filter(v => v.assigned_vsm_id === pid || v.assigned_panelist_id === pid);
            const pending = assigned.filter(v => ['Submitted', 'Under Review', 'Panel Review'].includes(v.status)).length;
            const completed = assigned.filter(v => !['Submitted', 'Under Review', 'Panel Review', 'Draft'].includes(v.status)).length;
            const approved = assigned.filter(v => ['Approved', 'Contract Sent', 'Agreement Sent', 'Joined Program'].includes(v.status)).length;
            const rejected = assigned.filter(v => v.status === 'Rejected').length;

            // Avg turnaround: days from assignment to review completion
            const reviewedVentures = assigned.filter(v => !['Submitted', 'Under Review', 'Panel Review', 'Draft'].includes(v.status));
            let avgDays = 0;
            if (reviewedVentures.length > 0) {
                const totalDays = reviewedVentures.reduce((sum, v) => {
                    const hist = statusHistory.filter(h => h.venture_id === v.id);
                    if (hist.length >= 2) {
                        const first = new Date(hist[hist.length - 1].created_at);
                        const last = new Date(hist[0].created_at);
                        return sum + Math.max(1, Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
                    }
                    return sum + 1;
                }, 0);
                avgDays = Math.round(totalDays / reviewedVentures.length);
            }

            return {
                id: pid,
                name: p.full_name || 'Unknown',
                role: p.role,
                roleLabel: roleLabel(p.role),
                pendingReviews: pending,
                completedReviews: completed,
                approved,
                rejected,
                avgTurnaroundDays: avgDays,
            };
        })
        .filter(p => {
            if (perfSearch && !p.name.toLowerCase().includes(perfSearch.toLowerCase())) return false;
            if (perfRoleFilter && p.role !== perfRoleFilter) return false;
            return true;
        })
        .sort((a, b) => b.completedReviews - a.completedReviews);

    // ─── Add User Handler ────────────────────────────────────────────
    const handleAddUser = async () => {
        setAddingUser(true);
        setAddUserError('');
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ full_name: newUserName, email: newUserEmail, role: newUserRole }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || err.message || 'Failed to create user');
            }
            setShowAddUser(false);
            setNewUserName('');
            setNewUserEmail('');
            setNewUserRole('success_mgr');
            fetchStaffEmails();
        } catch (err: any) {
            setAddUserError(err.message);
        } finally {
            setAddingUser(false);
        }
    };

    // ─── Users Tab Data ──────────────────────────────────────────────
    const filteredUsers = staffUsers.filter(u => {
        if (userSearch) {
            const q = userSearch.toLowerCase();
            if (!u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    // ─── Render ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">

            {/* ─── TAB: APPLICATION DASHBOARD ─── */}
            {tab === 'applications' && (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Applications Overview</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Track application pipeline and program enrollment.</p>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            {
                                label: 'Total Applications',
                                value: totalApplications,
                                sub: 'Received to date',
                                icon: FileText,
                                iconBg: 'bg-indigo-50',
                                iconColor: 'text-indigo-500',
                            },
                            {
                                label: 'Pending Screening',
                                value: pendingScreening,
                                sub: 'Awaiting review',
                                icon: Clock,
                                iconBg: 'bg-amber-50',
                                iconColor: 'text-amber-500',
                            },
                            {
                                label: 'Pending with Panel',
                                value: pendingPanel,
                                icon: Users,
                                iconBg: 'bg-rose-50',
                                iconColor: 'text-rose-500',
                                breakdown: [
                                    { label: 'Prime', value: pendingPanelPrime, color: 'text-purple-600' },
                                    { label: 'Core/Select', value: pendingPanelCore + pendingPanelSelect, color: 'text-indigo-600' },
                                ],
                            },
                            {
                                label: 'With Business',
                                value: withBusiness,
                                icon: Building2,
                                iconBg: 'bg-emerald-50',
                                iconColor: 'text-emerald-500',
                                breakdown: [
                                    { label: 'Pending', value: pendingBusiness, color: 'text-amber-600' },
                                    { label: 'Joined', value: joinedProgram, color: 'text-green-600' },
                                    { label: 'Declined', value: declinedBusiness, color: 'text-red-500' },
                                ],
                            },
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col justify-between">
                                <div className="flex items-start justify-between mb-3">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
                                    <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                                        <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                                {card.sub && <div className="text-xs text-gray-400 mt-1">{card.sub}</div>}
                                {card.breakdown && (
                                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-100">
                                        {card.breakdown.map(b => (
                                            <span key={b.label} className="text-xs text-gray-500">
                                                {b.label} <span className={`font-semibold ${b.color}`}>{b.value}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Middle Row: Joined Programs + Panel Received */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-900">Businesses Joined Programs</h3>
                                <span className="text-2xl font-bold text-indigo-600">{joinedProgram}</span>
                            </div>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Prime', count: joinedPrime, color: 'bg-green-500' },
                                    { label: 'Core/Select', count: joinedCore + joinedSelect, color: 'bg-blue-500' },
                                    { label: 'Selfserve', count: joinedSelfserve, color: 'bg-purple-500' },
                                ].map(p => (
                                    <div key={p.label} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${p.color}`} />
                                            <span className="text-sm text-gray-600">{p.label}</span>
                                        </div>
                                        <span className="text-sm font-semibold text-gray-900">{p.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-900">Applications Received by Panel</h3>
                                <span className="text-2xl font-bold text-indigo-600">{panelReceivedPrime + panelReceivedCore + panelReceivedSelect}</span>
                            </div>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-gray-400 uppercase tracking-wide">
                                        <th className="text-left py-1.5 font-medium">Program</th>
                                        <th className="text-center py-1.5 font-medium">Received</th>
                                        <th className="text-center py-1.5 font-medium">Approved</th>
                                        <th className="text-center py-1.5 font-medium">Rejected</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {[
                                        { label: 'Prime', received: panelReceivedPrime, approved: panelApprovedPrime, rejected: panelRejectedPrime },
                                        { label: 'Core/Select', received: panelReceivedCore + panelReceivedSelect, approved: panelApprovedCore + panelApprovedSelect, rejected: panelRejectedCore + panelRejectedSelect },
                                    ].map(r => (
                                        <tr key={r.label} className="border-t border-gray-100">
                                            <td className="py-2 font-medium text-gray-700">{r.label}</td>
                                            <td className="text-center py-2 text-gray-600">{r.received}</td>
                                            <td className="text-center py-2 text-green-600 font-medium">{r.approved}</td>
                                            <td className="text-center py-2 text-red-500 font-medium">{r.rejected}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t border-gray-300">
                                        <td className="py-2 font-semibold text-gray-900">Total</td>
                                        <td className="text-center py-2 font-semibold text-gray-900">{panelReceivedPrime + panelReceivedCore + panelReceivedSelect}</td>
                                        <td className="text-center py-2 font-semibold text-green-600">{panelApprovedPrime + panelApprovedCore + panelApprovedSelect}</td>
                                        <td className="text-center py-2 font-semibold text-red-500">{panelRejectedPrime + panelRejectedCore + panelRejectedSelect}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Applications Table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">All Applications</h2>
                            <button onClick={exportCSV} className="flex items-center gap-1.5 text-indigo-600 text-xs font-medium hover:text-indigo-700 transition-colors">
                                <Download className="w-3.5 h-3.5" /> Export CSV
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search business name..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">All Statuses</option>
                                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>

                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/80 border-b border-gray-200">
                                    <tr>
                                        {[
                                            { field: 'name' as SortField, label: 'Business Name' },
                                            { field: 'created_at' as SortField, label: 'Submitted' },
                                            { field: 'status' as SortField, label: 'Status' },
                                            { field: 'program_recommendation' as SortField, label: 'Program' },
                                            { field: 'assigned_to' as SortField, label: 'Assigned To' },
                                            { field: 'total_aging' as SortField, label: 'Total Aging' },
                                            { field: 'status_aging' as SortField, label: 'Status Aging' },
                                        ].map(col => (
                                            <th key={col.field} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 transition-colors" onClick={() => toggleSort(col.field)}>
                                                <span className="flex items-center gap-1">{col.label} <SortIcon field={col.field} /></span>
                                            </th>
                                        ))}
                                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredVentures.map(v => {
                                        const totalAging = daysSince(v.created_at);
                                        const statusAging = getStatusAging(v.id);
                                        const assignedName = profiles[v.assigned_panelist_id || '']?.full_name || profiles[v.assigned_vsm_id || '']?.full_name || '-';
                                        return (
                                            <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-2.5 font-medium text-sm">
                                                    <button onClick={() => openVentureProfile(v)} className="text-indigo-600 hover:text-indigo-800 hover:underline transition-colors text-left">{v.name}</button>
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-500 text-sm">{new Date(v.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td className="px-4 py-2.5">{getStatusBadge(shortStatusLabel(getDisplayStatus(v)))}</td>
                                                <td className="px-4 py-2.5">
                                                    {v.program_recommendation ? (() => {
                                                        const short = shortProgramName(v.program_recommendation);
                                                        return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                                            short === 'Prime' ? 'bg-purple-50 text-purple-700' :
                                                            short === 'Core' ? 'bg-indigo-50 text-indigo-700' :
                                                            short === 'Select' ? 'bg-blue-50 text-blue-700' :
                                                            'bg-gray-50 text-gray-700'
                                                        }`}>{short}</span>;
                                                    })() : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-gray-500 text-sm">{assignedName === '-' ? <span className="text-gray-300">—</span> : assignedName}</td>
                                                <td className="px-4 py-2.5 text-gray-500 text-sm">{totalAging}d</td>
                                                <td className={`px-4 py-2.5 text-sm font-medium ${statusAging > 14 ? 'text-red-600' : statusAging > 7 ? 'text-amber-600' : 'text-gray-500'}`}>{statusAging}d</td>
                                                <td className="px-4 py-2.5">
                                                    <button onClick={() => setTimelineVenture(v)} className="text-indigo-600 text-xs font-medium hover:text-indigo-700 transition-colors">View</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredVentures.length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">No applications found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── TAB: SCREENING PERFORMANCE ─── */}
            {tab === 'performance' && (
                <div className="space-y-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Screening Performance</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Review activity and turnaround times for screening managers and panelists.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search user..."
                                value={perfSearch}
                                onChange={e => setPerfSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <select
                            value={perfRoleFilter}
                            onChange={e => setPerfRoleFilter(e.target.value)}
                            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="">All Roles</option>
                            <option value="success_mgr">Screening Manager</option>
                            <option value="venture_mgr">Panel (Prime)</option>
                            <option value="committee_member">Panel (Core/Select)</option>
                        </select>
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/80 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Approved</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Rejected</th>
                                    <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Avg. Turnaround</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {performanceData.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-semibold text-indigo-600">
                                                    {p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{p.name}</div>
                                                    <div className="text-xs text-gray-400">{p.roleLabel}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center px-4 py-2.5">
                                            <span className={`text-sm font-medium ${p.pendingReviews > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{p.pendingReviews}</span>
                                        </td>
                                        <td className="text-center px-4 py-2.5 text-sm text-gray-600">{p.completedReviews}</td>
                                        <td className="text-center px-4 py-2.5">
                                            <span className="text-sm font-medium text-green-600">{p.approved}</span>
                                        </td>
                                        <td className="text-center px-4 py-2.5">
                                            <span className="text-sm font-medium text-red-500">{p.rejected}</span>
                                        </td>
                                        <td className="text-center px-4 py-2.5 text-sm text-gray-600">{p.avgTurnaroundDays}d</td>
                                    </tr>
                                ))}
                                {performanceData.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">No performance data available</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ─── TAB: USERS ─── */}
            {tab === 'users' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Manage access and roles for the operations team.</p>
                        </div>
                        <button
                            onClick={() => setShowAddUser(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <UserPlus className="w-4 h-4" /> Add User
                        </button>
                    </div>

                    <div className="relative max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/80 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-semibold text-indigo-600">
                                                    {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-medium text-gray-900">{u.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-sm text-gray-500">{u.email}</td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                                                u.role === 'success_mgr' ? 'bg-amber-50 text-amber-700' :
                                                u.role === 'venture_mgr' ? 'bg-purple-50 text-purple-700' :
                                                u.role === 'committee_member' ? 'bg-indigo-50 text-indigo-700' :
                                                u.role === 'admin' ? 'bg-gray-100 text-gray-700' :
                                                'bg-gray-50 text-gray-600'
                                            }`}>
                                                {roleLabel(u.role)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                Active
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredUsers.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400 text-sm">No users found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Add User Modal */}
                    {showAddUser && (
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <h3 className="text-base font-semibold text-gray-900">Add New User</h3>
                                    <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
                                </div>
                                {addUserError && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{addUserError}</div>}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
                                        <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Enter full name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                                        <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="user@example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
                                        <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                                            <option value="success_mgr">Screening Manager</option>
                                            <option value="venture_mgr">Panel (Prime)</option>
                                            <option value="committee_member">Panel (Core/Select)</option>
                                            <option value="ops_manager">Ops Manager</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleAddUser}
                                        disabled={addingUser || !newUserName || !newUserEmail}
                                        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        {addingUser ? 'Creating...' : 'Create User'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* ─── VENTURE PROFILE DRAWER ─── */}
            {profileVenture && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/30 transition-opacity"
                        onClick={() => setProfileVenture(null)}
                    />
                    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
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
                                        <div className="text-lg font-bold text-gray-900">{profileVenture.revenue_12m ? (isNaN(Number(profileVenture.revenue_12m)) ? profileVenture.revenue_12m : `₹${profileVenture.revenue_12m} Cr`) : 'N/A'}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Incremental Revenue (3Y)</span>
                                        <div className="text-lg font-bold text-gray-900">{profileVenture.revenue_potential_3y ? (isNaN(Number(profileVenture.revenue_potential_3y)) ? profileVenture.revenue_potential_3y : `₹${profileVenture.revenue_potential_3y} Cr`) : 'N/A'}</div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Employees</span>
                                        <div className="text-lg font-bold text-gray-900 flex items-center gap-1">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            {profileVenture.full_time_employees || 'N/A'}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Jobs</span>
                                        <div className="text-lg font-bold text-gray-900 flex items-center gap-1">
                                            <Users className="w-4 h-4 text-gray-400" />
                                            {profileVenture.target_jobs || 'N/A'}
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

                                {/* Screening SCALE Scorecard (Read-only) */}
                                {profileVenture.ai_analysis?.scorecard && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-amber-500" />
                                            <span className="text-base font-bold text-gray-700">Screening SCALE Scorecard</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimension</th>
                                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Brief</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {profileVenture.ai_analysis.scorecard.map((item: any, i: number) => {
                                                        const style = item.rating === 'Green' ? { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' } :
                                                            item.rating === 'Red' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' } :
                                                            { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
                                                        return (
                                                            <tr key={i} className={`${style.bg}`}>
                                                                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{item.dimension}</td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${style.text}`}>
                                                                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                                                        {item.rating}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-700 text-xs">{item.brief}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Panel SCALE Scorecard (Read-only) */}
                                {profileVenture.panel_ai_analysis?.panel_scorecard && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                            <Target className="w-5 h-5 text-teal-500" />
                                            <span className="text-base font-bold text-gray-700">Panel SCALE Scorecard</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b border-gray-200">
                                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimension</th>
                                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">App Rating</th>
                                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Panel Rating</th>
                                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Panel Brief</th>
                                                        {profileVenture.panel_ai_analysis.panel_scorecard.some((item: any) => item.panel_remarks) && (
                                                            <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {profileVenture.panel_ai_analysis.panel_scorecard.map((item: any, i: number) => {
                                                        const panelStyle = item.panel_rating === 'Green' ? { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' } :
                                                            item.panel_rating === 'Red' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' } :
                                                            { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
                                                        const appStyle = item.application_rating === 'Green' ? { text: 'text-green-700', dot: 'bg-green-500' } :
                                                            item.application_rating === 'Red' ? { text: 'text-red-700', dot: 'bg-red-500' } :
                                                            { text: 'text-amber-700', dot: 'bg-amber-500' };
                                                        return (
                                                            <tr key={i} className={`${panelStyle.bg}`}>
                                                                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{item.dimension}</td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/80 ${appStyle.text}`}>
                                                                        <span className={`w-2 h-2 rounded-full ${appStyle.dot}`} />
                                                                        {item.application_rating}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-3 text-center">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${panelStyle.text} border border-current/20`}>
                                                                        <span className={`w-2 h-2 rounded-full ${panelStyle.dot}`} />
                                                                        {item.panel_rating}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-700 text-xs">{item.panel_brief}</td>
                                                                {profileVenture.panel_ai_analysis.panel_scorecard.some((it: any) => it.panel_remarks) && (
                                                                    <td className="px-4 py-3 text-gray-600 text-xs">{item.panel_remarks || '—'}</td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Gate Questions (Read-only) */}
                                {profileVenture.gate_questions?.gate_questions && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                                            <span className="text-base font-bold text-gray-700">Panel Gate Questions</span>
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {profileVenture.gate_questions.gate_questions.map((gq: any, i: number) => (
                                                <div key={i} className="px-5 py-3 flex items-start gap-3">
                                                    <span className="text-xs font-bold text-gray-400 mt-0.5">{i + 1}.</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-gray-800">{gq.question}</p>
                                                        {gq.remarks && <p className="text-xs text-gray-500 mt-1">{gq.remarks}</p>}
                                                    </div>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gq.answer === 'Yes' ? 'bg-green-100 text-green-700' : gq.answer === 'No' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {gq.answer || '—'}
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

            {/* ─── TIMELINE DRAWER ─── */}
            {timelineVenture && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/20" onClick={() => setTimelineVenture(null)} />
                    <div className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
                        {/* Header */}
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="text-lg font-bold text-gray-900">Application Timeline</h2>
                            <button onClick={() => setTimelineVenture(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Venture Info */}
                            <div className="mb-6">
                                <h3 className="text-xl font-bold text-gray-900">{timelineVenture.name}</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    {getStatusBadge(shortStatusLabel(getDisplayStatus(timelineVenture)))}
                                    {timelineVenture.program_recommendation && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            {shortProgramName(timelineVenture.program_recommendation)}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-gray-200 pt-5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4">Application History</h4>
                                {(() => {
                                    // Build timeline: start with submission, then status changes
                                    const history = statusHistory
                                        .filter(h => h.venture_id === timelineVenture.id)
                                        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                                    // Build timeline events
                                    const events: { title: string; subtitle: string; person: string; date: string; icon: 'green' | 'blue' | 'red' | 'amber' }[] = [];

                                    // Application submitted (use venture created_at)
                                    events.push({
                                        title: 'Application submitted',
                                        subtitle: 'Application received from business portal',
                                        person: timelineVenture.founder_name || timelineVenture.name,
                                        date: timelineVenture.created_at,
                                        icon: 'green',
                                    });

                                    // Assigned to screening manager
                                    const vsmName = profiles[timelineVenture.assigned_vsm_id || '']?.full_name;
                                    if (vsmName) {
                                        const assignDate = history.length > 0 ? history[0].created_at : timelineVenture.created_at;
                                        events.push({ title: 'Assigned to screening manager', subtitle: `Application assigned for screening review`, person: vsmName, date: assignDate, icon: 'blue' });
                                    }

                                    // Status changes from history
                                    for (const h of history) {
                                        const newVal = h.new_value;
                                        const prevVal = h.previous_value;
                                        const changedByName = profiles[h.changed_by]?.full_name || '';
                                        const role = h.changed_by_role;

                                        if (newVal === 'Under Review') {
                                            events.push({ title: 'Screening started', subtitle: 'Application under review by screening manager', person: changedByName, date: h.created_at, icon: 'blue' });
                                        } else if (newVal === 'Panel Review') {
                                            const prog = shortProgramName(timelineVenture.program_recommendation);
                                            events.push({ title: 'Screening manager review complete', subtitle: prog ? `Recommended for ${prog}` : 'Sent to panel', person: changedByName, date: h.created_at, icon: 'green' });
                                            // Assigned to panelist
                                            const panelistName = profiles[timelineVenture.assigned_panelist_id || '']?.full_name;
                                            if (panelistName) {
                                                events.push({ title: 'Assigned to panel', subtitle: 'Application assigned for panel review', person: panelistName, date: h.created_at, icon: 'blue' });
                                            }
                                        } else if (newVal === 'Approved') {
                                            const prog = shortProgramName(timelineVenture.program_recommendation);
                                            const panelLabel = prog === 'Prime' ? 'Panel (Prime)' : 'Panel (Core/Select)';
                                            events.push({ title: `${panelLabel} review complete`, subtitle: 'Program approved', person: changedByName, date: h.created_at, icon: 'green' });
                                        } else if (newVal === 'Contract Sent' || newVal === 'Agreement Sent') {
                                            events.push({ title: 'Agreement sent', subtitle: 'Contract sent to business for review', person: changedByName, date: h.created_at, icon: 'blue' });
                                        } else if (newVal === 'Joined Program') {
                                            // Infer panel approval if previous status was Panel Review (no explicit Approved entry)
                                            if (prevVal === 'Panel Review') {
                                                const prog = shortProgramName(timelineVenture.program_recommendation);
                                                const panelLabel = prog === 'Prime' ? 'Panel (Prime)' : 'Panel (Core/Select)';
                                                const assignedPanelist = profiles[timelineVenture.assigned_panelist_id || '']?.full_name || '';
                                                events.push({ title: `${panelLabel} review complete`, subtitle: 'Program approved', person: assignedPanelist, date: h.created_at, icon: 'green' });
                                            }
                                            events.push({ title: 'Business accepted', subtitle: 'Business joined the program', person: changedByName || timelineVenture.name, date: h.created_at, icon: 'green' });
                                        } else if (newVal === 'Rejected') {
                                            // Infer panel rejection if previous status was Panel Review
                                            if (prevVal === 'Panel Review' && role === 'entrepreneur') {
                                                const prog = shortProgramName(timelineVenture.program_recommendation);
                                                const panelLabel = prog === 'Prime' ? 'Panel (Prime)' : 'Panel (Core/Select)';
                                                const assignedPanelist = profiles[timelineVenture.assigned_panelist_id || '']?.full_name || '';
                                                events.push({ title: `${panelLabel} review complete`, subtitle: 'Program approved', person: assignedPanelist, date: h.created_at, icon: 'green' });
                                            }
                                            const isBusinessDecline = role === 'entrepreneur';
                                            events.push({
                                                title: isBusinessDecline ? 'Business declined' : 'Application rejected',
                                                subtitle: isBusinessDecline ? 'Business declined the program offer' : 'Application was not approved',
                                                person: changedByName || timelineVenture.name,
                                                date: h.created_at,
                                                icon: 'red',
                                            });
                                        }
                                    }

                                    if (events.length <= 1 && history.length === 0) {
                                        return <p className="text-sm text-gray-400 text-center py-8">No history available yet.</p>;
                                    }

                                    const iconColors = {
                                        green: 'bg-emerald-500',
                                        blue: 'bg-blue-500',
                                        red: 'bg-red-500',
                                        amber: 'bg-amber-500',
                                    };

                                    return (
                                        <div className="relative">
                                            {/* Vertical line */}
                                            <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-gray-200" />

                                            <div className="space-y-6">
                                                {events.map((evt, i) => (
                                                    <div key={i} className="relative flex gap-4">
                                                        {/* Icon */}
                                                        <div className={`w-[34px] h-[34px] rounded-full ${iconColors[evt.icon]} flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                                                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                {evt.icon === 'red'
                                                                    ? <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                    : <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                }
                                                            </svg>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0 pb-1">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-gray-900">{evt.title}</p>
                                                                    <p className="text-xs text-gray-500 mt-0.5">{evt.subtitle}</p>
                                                                </div>
                                                                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                                                                    {new Date(evt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, {new Date(evt.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                                </span>
                                                            </div>
                                                            {evt.person && (
                                                                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                                                                    <Users className="w-3 h-3" />
                                                                    {evt.person}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
