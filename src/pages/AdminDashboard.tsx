import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatRevenue } from '../utils/formatters';
import { supabase } from '../lib/supabase';
import {
    Loader2, Search, FileText, Clock, Users, Building2, Download, CheckCircle2,
    ChevronUp, ChevronDown, UserPlus, X, TrendingUp,
} from 'lucide-react';
import { getRoleDisplayLabel } from '../utils/roleLabels';

// ─── Types ───────────────────────────────────────────────────────────
interface Venture {
    id: string;
    name: string;
    founder_name?: string;
    city?: string;
    state?: string;
    status: string;
    program_recommendation?: string;
    created_at: string;
    assigned_vsm_id?: string;
    assigned_panelist_id?: string;
    assigned_vm_id?: string;
    venture_partner?: string;
    agreement_status?: string;
    revenue_12m?: string;
    revenue_potential_3y?: string;
    full_time_employees?: string;
    target_jobs?: number;
    incremental_hiring?: number;
    kpi_status?: string;
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

export type AdminTab = 'applications' | 'venture-dashboard' | 'performance' | 'users';
type SortField = 'name' | 'created_at' | 'status' | 'program_recommendation' | 'assigned_to' | 'total_aging' | 'status_aging';
type SortDir = 'asc' | 'desc';

// ─── Helpers ─────────────────────────────────────────────────────────
function getDisplayStatus(v: Venture): string {
    const s = v.status;
    const rec = (v.program_recommendation || '').toLowerCase();
    if (s === 'Panel Review' && rec.includes('prime')) return 'Pending with Panel (Prime)';
    if (s === 'Panel Review') return 'Pending with Panel (Core/Select)';
    if (s === 'Assign VP/VM') return 'Pending Assignment to VP/VM';
    if (s === 'With VP/VM') return 'With VP/VM';
    if (s === 'Contract Sent' || s === 'Agreement Sent') return 'Pending with Business';
    if (s === 'Joined Program' || (s === 'Approved' && v.agreement_status?.toLowerCase() === 'signed')) return 'Accepted by Business';
    if (s === 'Rejected') return 'Declined by Business';
    if (s === 'Under Review' || s === 'Submitted') return 'Pending with Screening Manager';
    return s;
}

// Client's canonical list of statuses for the dropdown (exact order + labels)
const STATUS_ORDER = [
    'Pending with Screening Manager',
    'Pending with Panel (Prime)',
    'Pending with Panel (Core/Select)',
    'Pending Assignment to VP/VM',
    'With VP/VM',
    'Completed',
];

function shortProgramName(rec?: string): string {
    if (!rec) return '';
    const lower = rec.toLowerCase();
    if (lower.includes('prime')) return 'Prime';
    if (lower.includes('core') || lower.includes('select')) return 'Core/Select';
    if (lower.includes('selfserve')) return 'Selfserve';
    return rec;
}

function shortStatusLabel(label: string): string {
    if (label === 'Pending with Screening Manager') return 'Screening';
    if (label.startsWith('Pending with Panel')) return 'Panel Review';
    if (label === 'Pending Assignment to VP/VM') return 'Assign VP/VM';
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

function roleLabel(role: string, isPanelist?: boolean): string {
    return getRoleDisplayLabel(role, isPanelist);
}

// ─── Main Component ──────────────────────────────────────────────────
interface AdminDashboardProps {
    tab?: AdminTab;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ tab = 'applications' }) => {
    const [ventures, setVentures] = useState<Venture[]>([]);
    const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
    const [profiles, setProfiles] = useState<Record<string, { full_name: string; role: string }>>({});
    const [panelistNames, setPanelistNames] = useState<Set<string>>(new Set());
    const [statusHistory, setStatusHistory] = useState<any[]>([]);
    const [panelCategoryByVenture, setPanelCategoryByVenture] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    // Application filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [stateFilter, setStateFilter] = useState('');
    const [programFilter, setProgramFilter] = useState('');
    const [assignedFilter, setAssignedFilter] = useState('');
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Performance filters
    const [perfSearch, setPerfSearch] = useState('');
    const [perfRoleFilter, setPerfRoleFilter] = useState('');

    // User filters
    const [userSearch, setUserSearch] = useState('');

    // Venture dashboard filters
    const [vdSearch, setVdSearch] = useState('');
    const [vdStatus, setVdStatus] = useState('');
    const [vdState, setVdState] = useState('');
    const [vdCity, setVdCity] = useState('');
    const [vdProgram, setVdProgram] = useState('');
    const [roadmapCache, setRoadmapCache] = useState<Record<string, any>>({});
    const navigate = useNavigate();

    // Timeline drawer
    const [timelineVenture, setTimelineVenture] = useState<Venture | null>(null);

    // Add user modal
    const [showAddUser, setShowAddUser] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('success_mgr');
    const [addingUser, setAddingUser] = useState(false);
    const [addUserError, setAddUserError] = useState('');

    // ─── Fetch Data ──────────────────────────────────────────────────
    const fetchData = async () => {
        setLoading(true);
        try {
            // Ventures with assessments and applications
            const { data: ventureData } = await supabase
                .from('ventures')
                .select('*, assessments:venture_assessments(*), application:venture_applications(*)');

            const flat: Venture[] = (ventureData || []).map((v: any) => {
                const assessment = (v.assessments || []).find((a: any) => a.is_current) || v.assessments?.[0] || {};
                const app = v.application?.[0] || v.application || {};
                return {
                    ...v,
                    program_recommendation: assessment.program_recommendation,
                    revenue_12m: app.revenue_12m,
                    revenue_potential_3y: app.revenue_potential_3y,
                    full_time_employees: app.full_time_employees,
                    target_jobs: app.target_jobs,
                    incremental_hiring: app.incremental_hiring,
                    state: app.state,
                    city: v.city || app.city,
                    kpi_status: app.kpi_status,
                };
            });
            setVentures(flat);

            // Fetch roadmap RAG statuses for all ventures (bulk)
            const ventureIds = flat.map(v => v.id);
            if (ventureIds.length > 0) {
                const { data: roadmaps } = await supabase
                    .from('venture_roadmaps')
                    .select('venture_id, roadmap_data')
                    .in('venture_id', ventureIds)
                    .eq('is_current', true);
                if (roadmaps) {
                    const cache: Record<string, any> = {};
                    roadmaps.forEach((rm: any) => { cache[rm.venture_id] = rm.roadmap_data; });
                    setRoadmapCache(cache);
                }
            }

            // Profiles (all staff)
            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, email, role');
            const profileMap: Record<string, { full_name: string; email: string; role: string }> = {};
            (profileData || []).forEach((p: any) => { profileMap[p.id] = p; });

            // Panelists (assigned_panelist_id references panelists table, not profiles)
            const { data: panelistData } = await supabase
                .from('panelists')
                .select('id, name, program');
            const pNames = new Set<string>();
            (panelistData || []).forEach((p: any) => {
                pNames.add((p.name || '').toLowerCase());
                if (!profileMap[p.id]) {
                    profileMap[p.id] = { full_name: p.name, email: p.email || '', role: p.program === 'Prime' ? 'venture_mgr' : 'committee_member' };
                }
            });
            setPanelistNames(pNames);
            setProfiles(profileMap);

            // Staff users for Users tab
            const staffList: StaffUser[] = (profileData || [])
                .filter((p: any) => p.role && p.role !== 'entrepreneur')
                .map((p: any) => ({ id: p.id, full_name: p.full_name || '', email: p.email || '', role: p.role, created_at: '' }));
            setStaffUsers(staffList);

            // Status history for aging
            const { data: historyData } = await supabase
                .from('venture_status_history')
                .select('venture_id, previous_value, new_value, created_at, changed_by, changed_by_role')
                .order('created_at', { ascending: false });
            setStatusHistory(historyData || []);

            // Panel feedback: latest program_category per venture (panel's Core vs Select pick)
            if (ventureIds.length > 0) {
                const { data: pfData } = await supabase
                    .from('panel_feedback')
                    .select('venture_id, program_category, created_at')
                    .in('venture_id', ventureIds)
                    .order('created_at', { ascending: false });
                const categoryMap: Record<string, string> = {};
                (pfData || []).forEach((row: any) => {
                    if (row.program_category && !categoryMap[row.venture_id]) {
                        categoryMap[row.venture_id] = row.program_category.toLowerCase();
                    }
                });
                setPanelCategoryByVenture(categoryMap);
            }
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

    // Post-panel program category: prefer panel_feedback.program_category (panel's Core vs Select pick);
    // fallback to program_recommendation for Prime/Selfserve and *singular* Core/Select recs.
    // Only truly ambiguous case is combined "Core/Select" rec with no panel_feedback yet — returns ''.
    const venturePanelCategory = (v: Venture): 'prime' | 'core' | 'select' | 'selfserve' | '' => {
        const cat = panelCategoryByVenture[v.id];
        if (cat === 'core' || cat === 'select' || cat === 'prime') return cat;
        const rec = (v.program_recommendation || '').toLowerCase();
        if (rec.includes('prime')) return 'prime';
        if (rec.includes('selfserve')) return 'selfserve';
        const hasCore = rec.includes('core');
        const hasSelect = rec.includes('select');
        if (hasCore && !hasSelect) return 'core';
        if (hasSelect && !hasCore) return 'select';
        return '';
    };
    const isJoined = (v: Venture) => v.status === 'Joined Program' || (v.status === 'Approved' && v.agreement_status?.toLowerCase() === 'signed');
    const panelApprovedStatuses = ['Approved', 'Assign VP/VM', 'With VP/VM', 'Contract Sent', 'Agreement Sent', 'Joined Program'];

    // ─── Computed Stats ──────────────────────────────────────────────
    const totalApplications = ventures.length;
    const pendingScreening = ventures.filter(v => ['Submitted', 'Under Review'].includes(v.status)).length;
    const pendingPanel = ventures.filter(v => v.status === 'Panel Review').length;
    const pendingPanelPrime = ventures.filter(v => v.status === 'Panel Review' && isPrime(v.program_recommendation)).length;
    // Pre-panel, Core and Select aren't distinguishable — collapse into a single Core/Select count
    const pendingPanelCoreSelect = ventures.filter(v => v.status === 'Panel Review' && (isCore(v.program_recommendation) || isSelect(v.program_recommendation))).length;

    const joinedProgram = ventures.filter(v => isJoined(v)).length;

    const toBeAssignedVPVM = ventures.filter(v => v.status === 'Assign VP/VM').length;
    const toBeAssignedVPVMPrime = ventures.filter(v => v.status === 'Assign VP/VM' && venturePanelCategory(v) === 'prime').length;
    const toBeAssignedVPVMCore = ventures.filter(v => v.status === 'Assign VP/VM' && venturePanelCategory(v) === 'core').length;
    const toBeAssignedVPVMSelect = ventures.filter(v => v.status === 'Assign VP/VM' && venturePanelCategory(v) === 'select').length;

    const withVPVM = ventures.filter(v => v.status === 'With VP/VM').length;
    const withVPVMPrime = ventures.filter(v => v.status === 'With VP/VM' && venturePanelCategory(v) === 'prime').length;
    const withVPVMCore = ventures.filter(v => v.status === 'With VP/VM' && venturePanelCategory(v) === 'core').length;
    const withVPVMSelect = ventures.filter(v => v.status === 'With VP/VM' && venturePanelCategory(v) === 'select').length;

    const completed = ventures.filter(v => v.status === 'Completed').length;
    const completedSelfserve = ventures.filter(v => v.status === 'Completed' && isSelfserve(v.program_recommendation)).length;
    const completedPrime = ventures.filter(v => v.status === 'Completed' && venturePanelCategory(v) === 'prime').length;
    const completedCore = ventures.filter(v => v.status === 'Completed' && venturePanelCategory(v) === 'core').length;
    const completedSelect = ventures.filter(v => v.status === 'Completed' && venturePanelCategory(v) === 'select').length;

    const joinedPrime = ventures.filter(v => isJoined(v) && isPrime(v.program_recommendation)).length;
    // Joined Core/Select: use panel's pick (avoids "Core/Select" rec being counted in both buckets)
    const joinedCoreSelect = ventures.filter(v => isJoined(v) && (venturePanelCategory(v) === 'core' || venturePanelCategory(v) === 'select')).length;
    const joinedSelfserve = ventures.filter(v => isJoined(v) && isSelfserve(v.program_recommendation)).length;

    // Panel received = ventures that have a program recommendation
    const panelVentures = ventures.filter(v => v.program_recommendation);
    const panelReceivedPrime = panelVentures.filter(v => isPrime(v.program_recommendation)).length;
    // For Core/Select splits, use panel's actual pick from panel_feedback (pre-panel ventures keep rec-based matching)
    const isCoreSelectVenture = (v: Venture) => {
        const cat = venturePanelCategory(v);
        if (cat === 'core' || cat === 'select') return true;
        // Pre-panel: still counted as Core/Select if rec is combined or explicitly core/select
        if (!cat && (isCore(v.program_recommendation) || isSelect(v.program_recommendation))) return true;
        return false;
    };
    const panelReceivedCoreSelect = panelVentures.filter(isCoreSelectVenture).length;
    const panelApprovedPrime = panelVentures.filter(v => isPrime(v.program_recommendation) && panelApprovedStatuses.includes(v.status)).length;
    const panelApprovedCoreSelect = panelVentures.filter(v => isCoreSelectVenture(v) && panelApprovedStatuses.includes(v.status)).length;
    const panelRejectedPrime = panelVentures.filter(v => isPrime(v.program_recommendation) && v.status === 'Rejected').length;
    const panelRejectedCoreSelect = panelVentures.filter(v => isCoreSelectVenture(v) && v.status === 'Rejected').length;

    // ─── Status Aging ────────────────────────────────────────────────
    function getStatusAging(ventureId: string): number {
        const latest = statusHistory.find(h => h.venture_id === ventureId);
        if (latest) return daysSince(latest.created_at);
        const v = ventures.find(x => x.id === ventureId);
        return v ? daysSince(v.created_at) : 0;
    }

    // ─── Applications Table ──────────────────────────────────────────
    // Always render the client's full canonical list, even if no ventures currently match a given status
    const uniqueStatuses = STATUS_ORDER;
    const uniqueStates = Array.from(new Set(ventures.map(v => v.state).filter(Boolean) as string[])).sort();
    const getAssignee = (v: Venture): string => v.venture_partner || profiles[v.assigned_vm_id || '']?.full_name || profiles[v.assigned_panelist_id || '']?.full_name || profiles[v.assigned_vsm_id || '']?.full_name || '';
    const uniqueAssignees = Array.from(new Set(ventures.map(getAssignee).filter(Boolean))).sort();

    const filteredVentures = ventures
        .filter(v => {
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                if (!v.name.toLowerCase().includes(q) && !(v.founder_name || '').toLowerCase().includes(q)) return false;
            }
            if (statusFilter) {
                const vStatus = getDisplayStatus(v);
                if (statusFilter === 'Pending with Panel') {
                    if (!vStatus.startsWith('Pending with Panel')) return false;
                } else if (vStatus !== statusFilter) return false;
            }
            if (stateFilter && v.state !== stateFilter) return false;
            if (programFilter) {
                const cat = venturePanelCategory(v);
                if (programFilter === 'prime' && cat !== 'prime') return false;
                if (programFilter === 'core' && cat !== 'core') return false;
                if (programFilter === 'select' && cat !== 'select') return false;
                if (programFilter === 'selfserve' && cat !== 'selfserve') return false;
                // Pre-panel Core/Select: no panel pick yet, but rec indicates core/select path
                if (programFilter === 'core-select-pending') {
                    if (cat || !(isCore(v.program_recommendation) || isSelect(v.program_recommendation))) return false;
                }
            }
            if (assignedFilter) {
                const assignee = getAssignee(v);
                if (assignedFilter === '__unassigned__') { if (assignee) return false; }
                else if (assignee !== assignedFilter) return false;
            }
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
                roleLabel: roleLabel(p.role, panelistNames.has((p.full_name || '').toLowerCase())),
                pendingReviews: pending,
                completedReviews: completed,
                approved,
                rejected,
                avgTurnaroundDays: avgDays,
            };
        })
        .filter(p => {
            if (perfSearch && !p.name.toLowerCase().includes(perfSearch.toLowerCase())) return false;
            if (perfRoleFilter) {
                const isPanelist = panelistNames.has((p.name || '').toLowerCase());
                if (perfRoleFilter === 'venture_mgr_panel') {
                    if (p.role !== 'venture_mgr' || !isPanelist) return false;
                } else if (perfRoleFilter === 'committee_member_panel') {
                    if (p.role !== 'committee_member' || !isPanelist) return false;
                } else if (perfRoleFilter === 'venture_mgr_vpvm') {
                    if (p.role !== 'venture_mgr' || isPanelist) return false;
                } else if (perfRoleFilter === 'committee_member_vpvm') {
                    if (p.role !== 'committee_member' || isPanelist) return false;
                } else if (p.role !== perfRoleFilter) {
                    return false;
                }
            }
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
            // Parse composite role: e.g. "venture_mgr_panel" → role: "venture_mgr", is_panelist: true
            let role = newUserRole;
            let is_panelist = false;
            if (newUserRole.endsWith('_panel')) {
                role = newUserRole.replace('_panel', '');
                is_panelist = true;
            } else if (newUserRole.endsWith('_vpvm')) {
                role = newUserRole.replace('_vpvm', '');
                is_panelist = false;
            }
            const res = await fetch(`${API_URL}/api/admin/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ full_name: newUserName, email: newUserEmail, role, is_panelist }),
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
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        {[
                            {
                                label: 'Applications',
                                value: totalApplications,
                                sub: 'Total received',
                                icon: FileText,
                                iconBg: 'bg-indigo-50',
                                iconColor: 'text-indigo-500',
                                filterValue: '',
                            },
                            {
                                label: 'Pending with Screening Manager',
                                value: pendingScreening,
                                sub: 'Awaiting review',
                                icon: Clock,
                                iconBg: 'bg-purple-50',
                                iconColor: 'text-purple-500',
                                filterValue: 'Pending with Screening Manager',
                            },
                            {
                                label: 'Pending with Panel',
                                value: pendingPanel,
                                icon: Users,
                                iconBg: 'bg-rose-50',
                                iconColor: 'text-rose-500',
                                filterValue: 'Pending with Panel',
                                breakdown: [
                                    { label: 'Prime', value: pendingPanelPrime, color: 'text-purple-600' },
                                    { label: 'Core/Select', value: pendingPanelCoreSelect, color: 'text-green-600' },
                                ],
                            },
                            {
                                label: 'Pending Assignment to VP/VM',
                                value: toBeAssignedVPVM,
                                icon: Clock,
                                iconBg: 'bg-amber-50',
                                iconColor: 'text-amber-500',
                                filterValue: 'Pending Assignment to VP/VM',
                                breakdown: [
                                    { label: 'Prime', value: toBeAssignedVPVMPrime, color: 'text-purple-600' },
                                    { label: 'Core', value: toBeAssignedVPVMCore, color: 'text-green-600' },
                                    { label: 'Select', value: toBeAssignedVPVMSelect, color: 'text-indigo-600' },
                                ],
                            },
                            {
                                label: 'With VP/VM',
                                value: withVPVM,
                                icon: UserPlus,
                                iconBg: 'bg-emerald-50',
                                iconColor: 'text-emerald-500',
                                filterValue: 'With VP/VM',
                                breakdown: [
                                    { label: 'Prime', value: withVPVMPrime, color: 'text-purple-600' },
                                    { label: 'Core', value: withVPVMCore, color: 'text-green-600' },
                                    { label: 'Select', value: withVPVMSelect, color: 'text-indigo-600' },
                                ],
                            },
                            {
                                label: 'Completed',
                                value: completed,
                                icon: CheckCircle2,
                                iconBg: 'bg-emerald-50',
                                iconColor: 'text-emerald-600',
                                filterValue: 'Completed',
                                breakdown: [
                                    { label: 'Self', value: completedSelfserve, color: 'text-violet-600' },
                                    { label: 'Prime', value: completedPrime, color: 'text-purple-600' },
                                    { label: 'Core', value: completedCore, color: 'text-green-600' },
                                    { label: 'Select', value: completedSelect, color: 'text-indigo-600' },
                                ],
                            },
                        ].map(card => {
                            const isActive = statusFilter === card.filterValue;
                            return (
                                <button
                                    key={card.label}
                                    type="button"
                                    onClick={() => setStatusFilter(isActive ? '' : card.filterValue)}
                                    className={`text-left bg-white rounded-xl border shadow-sm p-4 flex flex-col min-h-[170px] transition-all hover:shadow-md hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                                        isActive ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider leading-tight flex-1 min-w-0">
                                            {card.label}
                                        </span>
                                        <div className={`shrink-0 w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                                            <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                                        </div>
                                    </div>
                                    <div className="text-3xl font-bold text-gray-900 leading-none">{card.value}</div>
                                    {card.sub && <div className="text-[11px] text-gray-400 mt-1.5">{card.sub}</div>}
                                    {card.breakdown && (() => {
                                        const isDense = card.breakdown.length >= 4;
                                        return (
                                            <div
                                                className={`grid ${isDense ? 'gap-1' : 'gap-2'} mt-auto pt-3 border-t border-gray-100`}
                                                style={{ gridTemplateColumns: `repeat(${card.breakdown.length}, minmax(0, 1fr))` }}
                                            >
                                                {card.breakdown.map(b => (
                                                    <div key={b.label} className="flex flex-col min-w-0">
                                                        <span className={`${isDense ? 'text-[9px]' : 'text-[10px]'} font-medium text-gray-400 uppercase truncate`}>{b.label}</span>
                                                        <span className={`text-sm font-bold ${b.color}`}>{b.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </button>
                            );
                        })}
                    </div>

                    {/* Middle Row: Joined Programs + Panel Received — hidden per client request, lets get it back later */}
                    <details className="group bg-white rounded-lg border border-gray-200 shadow-sm">
                        <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none">
                            <h3 className="text-sm font-semibold text-gray-900">Panel Application Evaluation and Business Program Acceptance</h3>
                            <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                        </summary>
                    <div className="grid grid-cols-2 gap-4 px-5 pb-5">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-900">Businesses Joined Programs</h3>
                                <span className="text-2xl font-bold text-indigo-600">{joinedProgram}</span>
                            </div>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Prime', count: joinedPrime, color: 'bg-green-500' },
                                    { label: 'Core/Select', count: joinedCoreSelect, color: 'bg-blue-500' },
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
                                <span className="text-2xl font-bold text-indigo-600">{panelReceivedPrime + panelReceivedCoreSelect}</span>
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
                                        { label: 'Core/Select', received: panelReceivedCoreSelect, approved: panelApprovedCoreSelect, rejected: panelRejectedCoreSelect },
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
                                        <td className="text-center py-2 font-semibold text-gray-900">{panelReceivedPrime + panelReceivedCoreSelect}</td>
                                        <td className="text-center py-2 font-semibold text-green-600">{panelApprovedPrime + panelApprovedCoreSelect}</td>
                                        <td className="text-center py-2 font-semibold text-red-500">{panelRejectedPrime + panelRejectedCoreSelect}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </details>

                    {/* Applications Table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">All Applications</h2>
                            <button onClick={exportCSV} className="flex items-center gap-1.5 text-indigo-600 text-xs font-medium hover:text-indigo-700 transition-colors">
                                <Download className="w-3.5 h-3.5" /> Export CSV
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                            <div className="relative flex-1 min-w-[220px] max-w-xs">
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
                                {statusFilter === 'Pending with Panel' && <option value="Pending with Panel">Pending with Panel</option>}
                                {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select
                                value={stateFilter}
                                onChange={e => setStateFilter(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">All States</option>
                                {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select
                                value={programFilter}
                                onChange={e => setProgramFilter(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">All Programs</option>
                                <option value="prime">Prime</option>
                                <option value="core">Core</option>
                                <option value="select">Select</option>
                                <option value="core-select-pending">Core/Select (pending panel)</option>
                                <option value="selfserve">Selfserve</option>
                            </select>
                            <select
                                value={assignedFilter}
                                onChange={e => setAssignedFilter(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">All Assignees</option>
                                <option value="__unassigned__">Unassigned</option>
                                {uniqueAssignees.map(a => <option key={a} value={a}>{a}</option>)}
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
                                        const assignedName = getAssignee(v) || '-';
                                        return (
                                            <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-4 py-2.5 font-medium text-sm">
                                                    <button onClick={() => navigate(`/admin/dashboard/application/${v.id}`)} className="text-left group">
                                                        <span className="block font-semibold text-indigo-600 group-hover:text-indigo-800 group-hover:underline transition-colors">{v.name}</span>
                                                        {(v.founder_name || v.city || v.state) && (
                                                            <span className="block text-xs text-gray-500 mt-0.5 font-normal">
                                                                {[v.founder_name, v.city, v.state].filter(Boolean).join(', ')}
                                                            </span>
                                                        )}
                                                    </button>
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
                            <option value="venture_mgr_panel">Panelist (Prime)</option>
                            <option value="committee_member_panel">Panelist (Core/Select)</option>
                            <option value="venture_mgr_vpvm">VM (Prime)</option>
                            <option value="committee_member_vpvm">VP (Core/Select)</option>
                            <option value="ops_manager">Ops Manager</option>
                            <option value="admin">Admin</option>
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
                                            {(() => {
                                                const isPanelist = panelistNames.has((u.full_name || '').toLowerCase());
                                                const label = roleLabel(u.role, isPanelist);
                                                const isVPVM = (u.role === 'venture_mgr' || u.role === 'committee_member') && !isPanelist;
                                                const style = isVPVM
                                                    ? 'bg-purple-50 text-purple-700'
                                                    : u.role === 'success_mgr' ? 'bg-amber-50 text-amber-700'
                                                    : u.role === 'venture_mgr' ? 'bg-purple-50 text-purple-700'
                                                    : u.role === 'committee_member' ? 'bg-indigo-50 text-indigo-700'
                                                    : u.role === 'admin' ? 'bg-gray-100 text-gray-700'
                                                    : 'bg-gray-50 text-gray-600';
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>
                                                        {label}
                                                    </span>
                                                );
                                            })()}
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
                                            <option value="venture_mgr_panel">Panelist (Prime)</option>
                                            <option value="committee_member_panel">Panelist (Core/Select)</option>
                                            <option value="venture_mgr_vpvm">VM (Prime)</option>
                                            <option value="committee_member_vpvm">VP (Core/Select)</option>
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

            {/* ─── VENTURE DASHBOARD TAB ─── */}
            {tab === 'venture-dashboard' && (() => {
                const programStatuses = ['With VP/VM'];
                const programVentures = ventures.filter(v => programStatuses.includes(v.status));

                const parseNum = (val: any): number => {
                    if (!val) return 0;
                    const str = String(val).replace(/\s*(crore|cr)\s*$/i, '').replace(/,/g, '').trim();
                    const num = parseFloat(str);
                    return isNaN(num) ? 0 : num;
                };

                const totalVentures = programVentures.length;
                const totalCurrentRevenue = programVentures.reduce((s, v) => s + parseNum(v.revenue_12m), 0);
                const totalIncrementalRevenue = programVentures.reduce((s, v) => s + parseNum(v.revenue_potential_3y), 0);
                const totalCurrentJobs = programVentures.reduce((s, v) => s + parseNum(v.full_time_employees), 0);
                const totalIncrementalJobs = programVentures.reduce((s, v) => s + parseNum(v.incremental_hiring || v.target_jobs || 0), 0);

                // Derive filter options from data
                const uniqueStates = Array.from(new Set(programVentures.map(v => v.state).filter(Boolean))).sort();
                const uniqueCities = Array.from(new Set(programVentures.map(v => v.city).filter(Boolean))).sort();

                const filtered = programVentures.filter(v => {
                    if (vdSearch) {
                        const q = vdSearch.toLowerCase();
                        if (!v.name.toLowerCase().includes(q) && !(v.founder_name || '').toLowerCase().includes(q)) return false;
                    }
                    if (vdStatus && !(v.kpi_status || 'Grey (Not Started Yet)').includes(vdStatus)) return false;
                    if (vdState && (v.state || '') !== vdState) return false;
                    if (vdCity && (v.city || '') !== vdCity) return false;
                    if (vdProgram) {
                        const rec = (v.program_recommendation || '').toLowerCase();
                        if (vdProgram === 'Prime' && !rec.includes('prime')) return false;
                        if (vdProgram === 'Core' && !rec.includes('core')) return false;
                        if (vdProgram === 'Select' && !rec.includes('select')) return false;
                    }
                    return true;
                });

                const getStatusDot = (kpiStatus?: string) => {
                    const s = kpiStatus || '';
                    return s.includes('Green') ? 'bg-green-500' : s.includes('Amber') ? 'bg-amber-500' : s.includes('Red') ? 'bg-red-500' : 'bg-gray-400';
                };

                const shortProg = (rec?: string) => {
                    if (!rec) return '';
                    const l = rec.toLowerCase();
                    return l.includes('prime') ? 'Prime' : l.includes('core') ? 'Core' : l.includes('select') ? 'Select' : rec;
                };

                return (
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-bold text-gray-900">My Ventures</h1>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                    Showing ventures with VP/VM
                                </span>
                            </div>
                            <p className="text-gray-500 mt-1">Manage and track your assigned venture portfolio.</p>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">No. of Ventures</p>
                                    <p className="text-2xl font-bold text-gray-900">{totalVentures}</p>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                                    <TrendingUp className="w-6 h-6 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 font-medium">Revenue</p>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <div>
                                            <p className="text-xs text-gray-400">Current</p>
                                            <p className="text-lg font-bold text-gray-900">{formatRevenue(totalCurrentRevenue)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Incremental revenue</p>
                                            <p className="text-lg font-bold text-green-600">+{formatRevenue(totalIncrementalRevenue)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs text-gray-500 font-medium">Jobs</p>
                                    <div className="flex items-baseline justify-between mt-1">
                                        <div>
                                            <p className="text-xs text-gray-400">Current FTE</p>
                                            <p className="text-lg font-bold text-gray-900">{totalCurrentJobs}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Incremental jobs</p>
                                            <p className="text-lg font-bold text-blue-600">+{totalIncrementalJobs}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" placeholder="Search by company name..." value={vdSearch} onChange={e => setVdSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                            </div>
                            <select value={vdStatus} onChange={e => setVdStatus(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">All Statuses</option>
                                <option value="Grey">Grey (Not Started Yet)</option>
                                <option value="Green">Green (On Track)</option>
                                <option value="Amber">Amber (Needs Attention)</option>
                                <option value="Red">Red (At Risk)</option>
                            </select>
                            {uniqueStates.length > 0 && (
                                <select value={vdState} onChange={e => setVdState(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="">All States</option>
                                    {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            )}
                            {uniqueCities.length > 0 && (
                                <select value={vdCity} onChange={e => setVdCity(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="">All Cities</option>
                                    {uniqueCities.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            )}
                            <select value={vdProgram} onChange={e => setVdProgram(e.target.value)}
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                <option value="">All Programs</option>
                                <option value="Prime">Prime</option>
                                <option value="Core">Core</option>
                                <option value="Select">Select</option>
                            </select>
                        </div>

                        {/* Venture Table */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50">
                                        <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Company Name</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Streams</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Revenue</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Jobs</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400 text-sm">No ventures in program yet.</td></tr>
                                    ) : filtered.map(v => (
                                        <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => navigate(`/admin/dashboard/venture/${v.id}`)} className="font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
                                                        {v.name}
                                                    </button>
                                                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusDot(v.kpi_status)}`} />
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                                    <span>{v.founder_name || '-'}</span>
                                                    <span>{v.city || '-'}</span>
                                                    <span>{shortProg(v.program_recommendation)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {(() => {
                                                    const rm = roadmapCache[v.id];
                                                    const streams = ['product', 'gtm', 'capital_planning', 'team', 'supply_chain', 'operations'];
                                                    const labels: Record<string, string> = { product: 'Product', gtm: 'GTM', capital_planning: 'Capital', team: 'Team', supply_chain: 'Supply', operations: 'Ops' };
                                                    if (!rm) return <span className="text-xs text-gray-300">—</span>;
                                                    return (
                                                        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                                                            {streams.map(key => {
                                                                const area = rm[key];
                                                                const rag = area?.rag_status || 'Grey (Not Started Yet)';
                                                                const dot = rag.includes('Red') ? 'bg-red-500' : rag.includes('Amber') ? 'bg-amber-500' : rag.includes('Green') ? 'bg-green-500' : 'bg-gray-300';
                                                                return (
                                                                    <div key={key} className="flex items-center gap-1.5" title={rag}>
                                                                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                                                                        <span className="text-[10px] text-gray-500 font-medium">{labels[key]}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-gray-500 text-xs">Current:</span>
                                                        <span className="font-semibold text-gray-900">{formatRevenue(v.revenue_12m)}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-gray-500 text-xs">Target:</span>
                                                        <span className="font-semibold text-green-600">{formatRevenue(v.revenue_potential_3y)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-gray-500 text-xs">Current:</span>
                                                        <span className="font-semibold text-gray-900">{parseNum(v.full_time_employees) || '-'}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-gray-500 text-xs">Target:</span>
                                                        <span className="font-semibold text-blue-600">{v.incremental_hiring || v.target_jobs || '-'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}

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
                                        } else if (newVal === 'Assign VP/VM') {
                                            const prog = shortProgramName(timelineVenture.program_recommendation);
                                            const panelLabel = prog === 'Prime' ? 'Panel (Prime)' : 'Panel (Core/Select)';
                                            events.push({ title: `${panelLabel} review complete`, subtitle: 'Program approved — pending VP/VM assignment', person: changedByName, date: h.created_at, icon: 'green' });
                                        } else if (newVal === 'With VP/VM') {
                                            const vmName = profiles[timelineVenture.assigned_vm_id || '']?.full_name || timelineVenture.venture_partner || changedByName;
                                            const prog = shortProgramName(timelineVenture.program_recommendation);
                                            const roleLabel = prog === 'Prime' ? 'Venture Manager' : 'Venture Partner';
                                            events.push({ title: `Assigned to ${roleLabel}`, subtitle: `${vmName} assigned as ${roleLabel}`, person: changedByName, date: h.created_at, icon: 'blue' });
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
