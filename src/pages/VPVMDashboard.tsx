import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatRevenue } from '../utils/formatters';
import {
    Loader2,
    Search,
    Building2,
    TrendingUp,
    Users,
    MapPin,
    ChevronDown,
    Filter,
} from 'lucide-react';

interface VentureCard {
    id: string;
    name: string;
    founder_name?: string;
    city?: string;
    status: string;
    program_recommendation?: string;
    revenue_12m?: string;
    revenue_potential_3y?: string;
    full_time_employees?: string;
    target_jobs?: number;
    incremental_hiring?: number;
    kpi_status?: string;
}

function parseNumeric(val: string | number | null | undefined): number {
    if (val === null || val === undefined || val === '') return 0;
    const str = String(val).replace(/\s*(crore|cr)\s*$/i, '').replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function getStatusDot(kpiStatus?: string): string {
    const s = kpiStatus || '';
    if (s.includes('Green')) return 'bg-green-500';
    if (s.includes('Amber')) return 'bg-amber-500';
    if (s.includes('Red')) return 'bg-red-500';
    return 'bg-gray-400'; // Grey (Not Started Yet) by default
}

function shortProgram(rec?: string): string {
    if (!rec) return '';
    const lower = rec.toLowerCase();
    if (lower.includes('prime')) return 'Prime';
    if (lower.includes('core')) return 'Core';
    if (lower.includes('select')) return 'Select';
    return rec;
}

export const VPVMDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [ventures, setVentures] = useState<VentureCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: ventureData } = await supabase
                    .from('ventures')
                    .select('*, application:venture_applications(*), assessments:venture_assessments(*)')
                    .eq('assigned_vm_id', user.id)
                    .is('deleted_at', null);

                const mapped: VentureCard[] = (ventureData || []).map((v: any) => {
                    const app = Array.isArray(v.application) ? v.application[0] || {} : v.application || {};
                    const assessment = (v.assessments || []).find((a: any) => a.is_current) || v.assessments?.[0] || {};
                    return {
                        id: v.id,
                        name: v.name,
                        founder_name: v.founder_name,
                        city: v.city,
                        status: v.status,
                        program_recommendation: assessment.program_recommendation,
                        revenue_12m: app.revenue_12m,
                        revenue_potential_3y: app.revenue_potential_3y,
                        full_time_employees: app.full_time_employees,
                        target_jobs: app.target_jobs,
                        incremental_hiring: app.incremental_hiring,
                        kpi_status: app.kpi_status,
                    };
                });

                setVentures(mapped);
            } catch (err) {
                console.error('Error fetching VP/VM ventures:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filtered = ventures.filter(v => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!v.name.toLowerCase().includes(q) && !(v.founder_name || '').toLowerCase().includes(q)) return false;
        }
        if (statusFilter && !(v.kpi_status || 'Grey (Not Started Yet)').includes(statusFilter)) return false;
        return true;
    });

    // Summary metrics
    const totalVentures = ventures.length;
    const totalCurrentRevenue = ventures.reduce((sum, v) => sum + parseNumeric(v.revenue_12m), 0);
    const totalIncrementalRevenue = ventures.reduce((sum, v) => sum + parseNumeric(v.revenue_potential_3y), 0);
    const totalCurrentJobs = ventures.reduce((sum, v) => sum + parseNumeric(v.full_time_employees), 0);
    const totalIncrementalJobs = ventures.reduce((sum, v) => sum + parseNumeric(v.incremental_hiring || v.target_jobs || 0), 0);

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
                <h1 className="text-2xl font-bold text-gray-900">My Ventures</h1>
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

            {/* Search & Filter */}
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by company name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="">All Statuses</option>
                            <option value="Grey">Grey (Not Started Yet)</option>
                            <option value="Green">Green (On Track)</option>
                            <option value="Amber">Amber (Needs Attention)</option>
                            <option value="Red">Red (At Risk)</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Venture Cards Grid */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                    <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No ventures assigned yet</p>
                    <p className="text-gray-400 text-sm mt-1">Ventures will appear here once assigned by the ops manager.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    {filtered.map((v) => (
                        <button
                            key={v.id}
                            onClick={() => navigate(`/vpvm/dashboard/venture/${v.id}`)}
                            className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-indigo-300 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                                    {v.name}
                                </h3>
                                <span className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${getStatusDot(v.kpi_status)}`} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                                <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {v.founder_name || '-'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {v.city || '-'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {shortProgram(v.program_recommendation)}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Revenue</p>
                                    <div className="space-y-0.5">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Current:</span>
                                            <span className="font-semibold text-gray-900">{formatRevenue(v.revenue_12m)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Target:</span>
                                            <span className="font-semibold text-green-600">{formatRevenue(v.revenue_potential_3y)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Jobs</p>
                                    <div className="space-y-0.5">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Current:</span>
                                            <span className="font-semibold text-gray-900">{parseNumeric(v.full_time_employees) || '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Target:</span>
                                            <span className="font-semibold text-blue-600">{v.incremental_hiring || v.target_jobs || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
