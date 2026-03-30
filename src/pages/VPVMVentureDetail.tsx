import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatRevenue } from '../utils/formatters';
import { InteractionsSection } from '../components/Interactions/InteractionsSection';
import {
    Loader2,
    ChevronUp,
    ChevronDown,
    ArrowLeft,
    Users,
    Calendar,
    Sparkles,
    Pencil,
    Package,
    Target,
    UserCheck,
    DollarSign,
    Truck,
    Settings,
} from 'lucide-react';

const STREAM_ICONS: Record<string, any> = {
    'Product': Package,
    'Go-To-Market': Target,
    'Team': UserCheck,
    'Financial Planning': DollarSign,
    'Supply Chain': Truck,
    'Operations': Settings,
};


function parseNumeric(val: string | number | null | undefined): number {
    if (val === null || val === undefined || val === '') return 0;
    const str = String(val).replace(/\s*(crore|cr)\s*$/i, '').replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

const ROADMAP_STREAM_KEYS = ['product', 'gtm', 'capital_planning', 'team', 'supply_chain', 'operations'] as const;
const ROADMAP_LABELS: Record<string, string> = {
    product: 'Product', gtm: 'Go-To-Market (GTM)', capital_planning: 'Capital Planning',
    team: 'Team', supply_chain: 'Supply Chain', operations: 'Operations'
};
const SUPPORT_STATUS_OPTIONS = ['Need Deep Support', 'Need Some Guidance', 'Do Not Need Help'];

const RoadmapGrid: React.FC<{ roadmapData: any; editing: boolean; onUpdate: (key: string, field: string, value: string) => void }> = ({ roadmapData, editing, onUpdate }) => (
    <div className="grid grid-cols-3 gap-4">
        {ROADMAP_STREAM_KEYS.map((key) => {
            const area = roadmapData[key];
            if (!area) return null;
            const StreamIcon = STREAM_ICONS[ROADMAP_LABELS[key]] || Package;
            const status = area.support_status || area.support_priority || 'Need Some Guidance';
            const statusStyle = status.toLowerCase().includes('deep') ? 'bg-red-50 text-red-600 border-red-200'
                : status.toLowerCase().includes('not') || status.toLowerCase().includes("don't") ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-amber-50 text-amber-600 border-amber-200';

            return (
                <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <StreamIcon className="w-4 h-4 text-gray-500" />
                            <h4 className="font-semibold text-gray-900 text-sm">{ROADMAP_LABELS[key]}</h4>
                        </div>
                        {editing ? (
                            <select
                                value={status}
                                onChange={e => onUpdate(key, 'support_status', e.target.value)}
                                className="text-xs px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                {SUPPORT_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        ) : (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle}`}>
                                {status}
                            </span>
                        )}
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Goal:</p>
                        {editing ? (
                            <textarea
                                value={area.end_goal || ''}
                                onChange={e => onUpdate(key, 'end_goal', e.target.value)}
                                rows={3}
                                className="w-full text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            />
                        ) : (
                            <p className="text-xs text-gray-600">{area.end_goal || '-'}</p>
                        )}
                    </div>
                </div>
            );
        })}
    </div>
);

export const VPVMVentureDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [venture, setVenture] = useState<any>(null);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [roadmapData, setRoadmapData] = useState<any>(null);
    const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
    const [loading, setLoading] = useState(true);

    // Collapsible sections
    const [scorecardOpen, setScorecardOpen] = useState(false);
    const [roadmapOpen, setRoadmapOpen] = useState(true);
    const [interactionsOpen, setInteractionsOpen] = useState(false);

    // KPI edit mode
    const [kpiEditing, setKpiEditing] = useState(false);
    const [kpiSaving, setKpiSaving] = useState(false);
    const [kpiForm, setKpiForm] = useState({ revenue_12m: '', revenue_potential_3y: '', full_time_employees: '', incremental_hiring: '', kpi_status: 'Grey (Not Started Yet)' });

    // Roadmap edit mode
    const [roadmapEditing, setRoadmapEditing] = useState(false);
    const [roadmapSaving, setRoadmapSaving] = useState(false);
    const [editedRoadmap, setEditedRoadmap] = useState<any>(null);

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) setCurrentUserId(user.id);
                const result = await api.getVenture(id);
                setVenture(result.venture);
                // Fetch AI-generated roadmap
                try {
                    const roadmap = await api.getRoadmap(id);
                    console.log('[VPVMDetail] Roadmap fetch result:', roadmap?.roadmap ? 'found' : 'not found');
                    if (roadmap?.roadmap?.roadmap_data) {
                        setRoadmapData(roadmap.roadmap.roadmap_data);
                    }
                } catch (rmErr) {
                    console.error('[VPVMDetail] Error fetching roadmap:', rmErr);
                }
            } catch (err) {
                console.error('Error fetching venture:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!venture) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Venture not found.</p>
                <button onClick={() => navigate('/vpvm/dashboard')} className="text-indigo-600 text-sm mt-2">Back to dashboard</button>
            </div>
        );
    }

    const programLabel = (venture.program_recommendation || '').toLowerCase().includes('prime') ? 'Prime'
        : (venture.program_recommendation || '').toLowerCase().includes('core') ? 'Core'
        : (venture.program_recommendation || '').toLowerCase().includes('select') ? 'Select'
        : venture.program_recommendation || '';

    const monthsInProgram = venture.created_at
        ? Math.max(1, Math.floor((Date.now() - new Date(venture.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)))
        : 0;

    const joinedDate = venture.created_at
        ? new Date(venture.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : '-';

    const kpiStatus = venture.kpi_status || 'Grey (Not Started Yet)';
    const overallDot = kpiStatus.includes('Red') ? 'bg-red-500'
        : kpiStatus.includes('Amber') ? 'bg-amber-500'
        : kpiStatus.includes('Green') ? 'bg-green-500'
        : 'bg-gray-400';

    const SectionHeader: React.FC<{ icon: any; title: string; open: boolean; onToggle: () => void; action?: React.ReactNode }> = ({
        icon: Icon, title, open, onToggle, action
    }) => (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3 cursor-pointer" onClick={onToggle}>
            <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">{title}</h3>
                {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
            {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Back button */}
            <button onClick={() => navigate('/vpvm/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to portfolio
            </button>

            {/* Venture Header */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{venture.name}</h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Name: {venture.founder_name || '-'}</span>
                            <span className="flex items-center gap-1"><Target className="w-4 h-4" /> City: {venture.city || '-'}</span>
                            <span className="flex items-center gap-1"><Package className="w-4 h-4" /> Program: {programLabel}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate(`/vpvm/dashboard/venture/${id}/details`)}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        View Details
                    </button>
                </div>
            </div>

            {/* KPI Section */}
            <div className="flex items-center justify-end mb-1">
                {kpiEditing ? (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setKpiEditing(false)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >Cancel</button>
                            <button
                                onClick={async () => {
                                    if (!id) return;
                                    setKpiSaving(true);
                                    try {
                                        const appUpdates: any = {};
                                        if (kpiForm.revenue_12m) appUpdates.revenue_12m = kpiForm.revenue_12m;
                                        if (kpiForm.revenue_potential_3y) appUpdates.revenue_potential_3y = kpiForm.revenue_potential_3y;
                                        if (kpiForm.full_time_employees) appUpdates.full_time_employees = kpiForm.full_time_employees;
                                        if (kpiForm.incremental_hiring) appUpdates.incremental_hiring = parseInt(kpiForm.incremental_hiring);
                                        if (kpiForm.kpi_status) appUpdates.kpi_status = kpiForm.kpi_status;

                                        if (Object.keys(appUpdates).length > 0) {
                                            await supabase.from('venture_applications').update(appUpdates).eq('venture_id', id);
                                        }

                                        // Refresh data
                                        const result = await api.getVenture(id);
                                        setVenture(result.venture);
                                        setKpiEditing(false);
                                    } catch (err) {
                                        console.error('Error saving KPIs:', err);
                                    } finally {
                                        setKpiSaving(false);
                                    }
                                }}
                                disabled={kpiSaving}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >{kpiSaving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                setKpiForm({
                                    revenue_12m: venture.revenue_12m || '',
                                    revenue_potential_3y: venture.revenue_potential_3y || '',
                                    full_time_employees: venture.full_time_employees || '',
                                    incremental_hiring: String(venture.incremental_hiring || venture.target_jobs || ''),
                                    kpi_status: venture.kpi_status || 'Grey (Not Started Yet)',
                                });
                                setKpiEditing(true);
                            }}
                            className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-700"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                        </button>
                    )}
            </div>
            <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Revenue</p>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Current</span>
                                {kpiEditing ? (
                                    <input type="text" value={kpiForm.revenue_12m} onChange={e => setKpiForm(f => ({ ...f, revenue_12m: e.target.value }))}
                                        className="w-24 text-right px-2 py-1 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                ) : (
                                    <span className="text-lg font-bold text-gray-900">{formatRevenue(venture.revenue_12m)}</span>
                                )}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Incremental revenue</span>
                                {kpiEditing ? (
                                    <input type="text" value={kpiForm.revenue_potential_3y} onChange={e => setKpiForm(f => ({ ...f, revenue_potential_3y: e.target.value }))}
                                        className="w-24 text-right px-2 py-1 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                ) : (
                                    <span className="text-lg font-bold text-green-600">{formatRevenue(venture.revenue_potential_3y)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Jobs</p>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Current FTE</span>
                                {kpiEditing ? (
                                    <input type="text" value={kpiForm.full_time_employees} onChange={e => setKpiForm(f => ({ ...f, full_time_employees: e.target.value }))}
                                        className="w-20 text-right px-2 py-1 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                ) : (
                                    <span className="text-lg font-bold text-gray-900">{parseNumeric(venture.full_time_employees) || '-'}</span>
                                )}
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-500">Incremental Jobs</span>
                                {kpiEditing ? (
                                    <input type="text" value={kpiForm.incremental_hiring} onChange={e => setKpiForm(f => ({ ...f, incremental_hiring: e.target.value }))}
                                        className="w-20 text-right px-2 py-1 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                ) : (
                                    <span className="text-lg font-bold text-blue-600">{venture.incremental_hiring || venture.target_jobs || '-'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Months in Program</p>
                        <p className="text-3xl font-bold text-gray-900">{monthsInProgram}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Calendar className="w-3 h-3" />
                            Submitted: {joinedDate}
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Status</p>
                        {kpiEditing ? (
                            <select value={kpiForm.kpi_status} onChange={e => setKpiForm(f => ({ ...f, kpi_status: e.target.value }))}
                                className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                                <option value="Grey (Not Started Yet)">Grey (Not Started Yet)</option>
                                <option value="Green (On Track)">Green (On Track)</option>
                                <option value="Amber (Needs Attention)">Amber (Needs Attention)</option>
                                <option value="Red (At Risk)">Red (At Risk)</option>
                            </select>
                        ) : (
                            <div className="flex items-center justify-center h-12">
                                <span className={`w-8 h-8 rounded-full ${overallDot}`} />
                            </div>
                        )}
                    </div>
                </div>

            {/* Panel Scorecard */}
            <SectionHeader
                icon={Sparkles}
                title="Panel Scorecard"
                open={scorecardOpen}
                onToggle={() => setScorecardOpen(!scorecardOpen)}
                action={
                    venture.panel_ai_analysis?.panel_scorecard ? (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-500">
                                Read Only
                            </span>
                            <span className="text-xs text-gray-400">
                                Generated by Panel
                                {venture.panel_ai_analysis?.generated_at
                                    ? ` on ${new Date(venture.panel_ai_analysis.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                    : ''}
                            </span>
                        </div>
                    ) : venture.ai_analysis?.scorecard ? (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-500">
                                Read Only
                            </span>
                            <span className="text-xs text-gray-400">Generated by Screening Manager</span>
                        </div>
                    ) : null
                }
            />
            {scorecardOpen && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {venture.panel_ai_analysis?.panel_scorecard ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimension</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">App Rating</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Panel Rating</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Panel Brief</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {venture.panel_ai_analysis.panel_scorecard.map((item: any, i: number) => {
                                        const ratingStyle = (rating: string) =>
                                            rating === 'Green' ? { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' }
                                            : rating === 'Red' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' }
                                            : { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
                                        const appStyle = ratingStyle(item.application_rating || item.app_rating || item.rating || '');
                                        const panelStyle = ratingStyle(item.panel_rating || '');
                                        return (
                                            <tr key={i} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{item.dimension}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 ${appStyle.text} font-semibold text-xs`}>
                                                        <span className={`w-2 h-2 rounded-full ${appStyle.dot}`} />
                                                        {item.application_rating || item.app_rating || item.rating || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    {item.panel_rating ? (
                                                        <span className={`inline-flex items-center gap-1.5 ${panelStyle.text} font-semibold text-xs`}>
                                                            <span className={`w-2 h-2 rounded-full ${panelStyle.dot}`} />
                                                            {item.panel_rating}
                                                        </span>
                                                    ) : <span className="text-gray-300">-</span>}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 text-xs leading-relaxed max-w-xs">{item.panel_brief || item.brief || '-'}</td>
                                                <td className="px-4 py-3 text-gray-600 text-xs leading-relaxed max-w-xs">{item.panel_remarks || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : venture.ai_analysis?.scorecard ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-gray-50">
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimension</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Assessment</th>
                                        <th className="text-center px-3 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Brief</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {venture.ai_analysis.scorecard.map((item: any, i: number) => {
                                        const style = item.rating === 'Green' ? { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' }
                                            : item.rating === 'Red' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' }
                                            : { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
                                        return (
                                            <tr key={i} className={style.bg}>
                                                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{item.dimension}</td>
                                                <td className="px-4 py-3 text-gray-600">{item.assessment}</td>
                                                <td className="px-3 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 ${style.text} font-semibold text-xs`}>
                                                        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                                        {item.rating}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 text-xs leading-relaxed max-w-xs">{item.brief}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-8">No scorecard available.</p>
                    )}
                </div>
            )}

            {/* Roadmap */}
            <SectionHeader
                icon={Sparkles}
                title="Roadmap"
                open={roadmapOpen}
                onToggle={() => setRoadmapOpen(!roadmapOpen)}
                action={
                    roadmapData ? (
                        roadmapEditing ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { setRoadmapEditing(false); setEditedRoadmap(null); }}
                                    className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                                >Cancel</button>
                                <button
                                    onClick={async () => {
                                        if (!id || !editedRoadmap) return;
                                        setRoadmapSaving(true);
                                        try {
                                            // Update the roadmap in venture_roadmaps
                                            await supabase.from('venture_roadmaps')
                                                .update({ roadmap_data: editedRoadmap })
                                                .eq('venture_id', id)
                                                .eq('is_current', true);
                                            setRoadmapData(editedRoadmap);
                                            setRoadmapEditing(false);
                                            setEditedRoadmap(null);
                                        } catch (err) {
                                            console.error('Error saving roadmap:', err);
                                        } finally {
                                            setRoadmapSaving(false);
                                        }
                                    }}
                                    disabled={roadmapSaving}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >{roadmapSaving ? 'Saving...' : 'Save Changes'}</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    setEditedRoadmap(JSON.parse(JSON.stringify(roadmapData)));
                                    setRoadmapEditing(true);
                                }}
                                className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-700"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit Roadmap
                            </button>
                        )
                    ) : null
                }
            />
            {roadmapOpen && (
                roadmapData ? (
                    <RoadmapGrid
                        roadmapData={roadmapEditing && editedRoadmap ? editedRoadmap : roadmapData}
                        editing={roadmapEditing}
                        onUpdate={(key, field, value) => {
                            if (!editedRoadmap) return;
                            const updated = { ...editedRoadmap };
                            updated[key] = { ...updated[key], [field]: value };
                            setEditedRoadmap(updated);
                        }}
                    />) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">Generate Roadmap</h3>
                        <p className="text-sm text-gray-500 mb-4">Generate a tailored roadmap based on panel feedback and venture context.</p>
                        <button
                            onClick={async () => {
                                if (!id || generatingRoadmap) return;
                                setGeneratingRoadmap(true);
                                try {
                                    const result = await api.generateRoadmap(id);
                                    if (result?.roadmap?.roadmap_data) {
                                        setRoadmapData(result.roadmap.roadmap_data);
                                    }
                                } catch (err: any) {
                                    console.error('Error generating roadmap:', err);
                                    // If timed out, try fetching — backend may have completed
                                    if (err.name === 'AbortError' || err.message?.includes('Failed')) {
                                        try {
                                            const rm = await api.getRoadmap(id);
                                            if (rm?.roadmap?.roadmap_data) {
                                                setRoadmapData(rm.roadmap.roadmap_data);
                                            }
                                        } catch { /* still no roadmap */ }
                                    }
                                } finally {
                                    setGeneratingRoadmap(false);
                                }
                            }}
                            disabled={generatingRoadmap}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
                        >
                            {generatingRoadmap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {generatingRoadmap ? 'Generating Roadmap...' : 'Generate Roadmap'}
                        </button>
                    </div>
                )
            )}

            {/* Interactions */}
            <SectionHeader
                icon={Sparkles}
                title="Interactions"
                open={interactionsOpen}
                onToggle={() => setInteractionsOpen(!interactionsOpen)}
            />
            {interactionsOpen && id && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <InteractionsSection ventureId={id} createdByOnly={currentUserId} />
                </div>
            )}

        </div>
    );
};
