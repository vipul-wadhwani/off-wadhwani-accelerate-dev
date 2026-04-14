import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatRevenue } from '../utils/formatters';
import { DeliverableDetail } from '../components/CurrentStatus/DeliverableDetail';
import { getDeliverableStyle } from '../components/CurrentStatus/constants';
import { ScheduleExpertSessionModal } from '../components/ScheduleExpertSessionModal';
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
    Video,
    MessageSquare,
    TrendingUp,
    AlertTriangle,
    CheckSquare,
    HelpCircle,
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

const HEALTH_CYCLE = ['on_track', 'needs_attention', 'at_risk'];
const DELIVERABLE_STATUS_CYCLE = ['pending', 'in_progress', 'completed'];

const RoadmapGrid: React.FC<{
    roadmapData: any;
    editing: boolean;
    onUpdate: (key: string, field: string, value: string) => void;
    deliverables?: any[];
    showDeliverables?: boolean;
    onDeliverableStatusChange?: (deliverableId: string, newStatus: string) => void;
    onDeliverableHealthChange?: (deliverableId: string, newHealth: string) => void;
    onDeliverableClick?: (deliverable: any) => void;
    readOnly?: boolean;
}> = ({ roadmapData, editing, onUpdate, deliverables = [], showDeliverables = false, onDeliverableStatusChange, onDeliverableHealthChange, onDeliverableClick, readOnly = false }) => {
    const [expandedStreams, setExpandedStreams] = useState<Set<string>>(new Set());
    const PREVIEW_COUNT = 2;

    const toggleStream = (key: string) => {
        setExpandedStreams(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
    <div className="grid grid-cols-3 gap-4">
        {ROADMAP_STREAM_KEYS.map((key) => {
            const area = roadmapData[key];
            if (!area) return null;
            const StreamIcon = STREAM_ICONS[ROADMAP_LABELS[key]] || Package;
            const status = area.support_status || area.support_priority || 'Need Some Guidance';
            const statusStyle = status.toLowerCase().includes('deep') ? 'bg-red-50 text-red-600 border-red-200'
                : status.toLowerCase().includes('not') || status.toLowerCase().includes("don't") ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-amber-50 text-amber-600 border-amber-200';

            const ragStatus = area.rag_status || 'Grey (Not Started Yet)';
            const ragDot = ragStatus.includes('Red') ? 'bg-red-500'
                : ragStatus.includes('Amber') ? 'bg-amber-500'
                : ragStatus.includes('Green') ? 'bg-green-500'
                : 'bg-gray-400';

            const STATUS_PRIORITY: Record<string, number> = { in_progress: 0, pending: 1, completed: 2 };
            const streamDeliverables = deliverables
                .filter(d => d.roadmap_key === key)
                .sort((a, b) => (STATUS_PRIORITY[a.status] ?? 1) - (STATUS_PRIORITY[b.status] ?? 1));

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
                    <div className="flex items-center gap-2 mb-3">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${ragDot}`} />
                        {editing ? (
                            <select
                                value={ragStatus}
                                onChange={e => onUpdate(key, 'rag_status', e.target.value)}
                                className="text-xs px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="Grey (Not Started Yet)">Grey (Not Started Yet)</option>
                                <option value="Green (On Track)">Green (On Track)</option>
                                <option value="Amber (Needs Attention)">Amber (Needs Attention)</option>
                                <option value="Red (At Risk)">Red (At Risk)</option>
                            </select>
                        ) : (
                            <span className="text-xs text-gray-500">{ragStatus}</span>
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

                    {/* Deliverables */}
                    {showDeliverables && streamDeliverables.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {(expandedStreams.has(key) ? streamDeliverables : streamDeliverables.slice(0, PREVIEW_COUNT)).map((del) => {
                                const cfg = getDeliverableStyle(del);
                                return (
                                    <div
                                        key={del.id}
                                        className="bg-gray-50 border border-gray-100 rounded-lg p-3 cursor-pointer hover:bg-gray-100 hover:border-gray-200 transition-colors"
                                        onClick={() => onDeliverableClick?.(del)}
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-900">{del.title}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <span className={`inline-flex items-center text-[10px] font-medium rounded border ${cfg.badge}`}>
                                                        {readOnly ? (
                                                            <span className="px-2 py-0.5">{cfg.label}{del.status === 'in_progress' && ` · ${del.health === 'at_risk' ? 'At Risk' : del.health === 'needs_attention' ? 'Needs Attention' : 'On Track'}`}</span>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const currentIdx = DELIVERABLE_STATUS_CYCLE.indexOf(del.status);
                                                                        const nextStatus = DELIVERABLE_STATUS_CYCLE[(currentIdx + 1) % DELIVERABLE_STATUS_CYCLE.length];
                                                                        onDeliverableStatusChange?.(del.id, nextStatus);
                                                                    }}
                                                                    className="px-2 py-0.5 hover:opacity-80 transition-opacity"
                                                                >
                                                                    {cfg.label}
                                                                </button>
                                                                {del.status === 'in_progress' && (
                                                                    <>
                                                                        <span className="text-[8px] opacity-40">|</span>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const currentIdx = HEALTH_CYCLE.indexOf(del.health || 'on_track');
                                                                                const nextHealth = HEALTH_CYCLE[(currentIdx + 1) % HEALTH_CYCLE.length];
                                                                                onDeliverableHealthChange?.(del.id, nextHealth);
                                                                            }}
                                                                            className="px-2 py-0.5 hover:opacity-80 transition-opacity"
                                                                            title="Click to change health"
                                                                        >
                                                                            {del.health === 'at_risk' ? 'At Risk' : del.health === 'needs_attention' ? 'Needs Attention' : 'On Track'}
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] text-gray-300">|</span>
                                                    <span className="text-[11px] font-medium text-gray-700 flex items-center gap-1">
                                                        <Users className="w-3 h-3 text-indigo-400" />
                                                        {del.owner || '—'}
                                                    </span>
                                                    <span className="text-[11px] font-medium text-gray-700 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3 text-indigo-400" />
                                                        {del.due_date ? new Date(del.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {streamDeliverables.length > PREVIEW_COUNT && (
                                <button
                                    onClick={() => toggleStream(key)}
                                    className="w-full text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 py-1.5"
                                >
                                    {expandedStreams.has(key)
                                        ? 'See less'
                                        : `See ${streamDeliverables.length - PREVIEW_COUNT} more`}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
    );
};

interface VPVMVentureDetailProps {
    ventureId?: string;
    readOnly?: boolean;
    hideKPIs?: boolean;
    backPath?: string;
    backLabel?: string;
}

export const VPVMVentureDetail: React.FC<VPVMVentureDetailProps> = ({ ventureId: propVentureId, readOnly = false, hideKPIs = false, backPath, backLabel }) => {
    const params = useParams<{ id: string }>();
    const id = propVentureId || params.id;
    const navigate = useNavigate();
    const [venture, setVenture] = useState<any>(null);
    const [roadmapData, setRoadmapData] = useState<any>(null);
    const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
    const [loading, setLoading] = useState(true);

    // Collapsible sections
    const [roadmapOpen, setRoadmapOpen] = useState(true);

    // KPI edit mode
    const [kpiEditing, setKpiEditing] = useState(false);
    const [kpiSaving, setKpiSaving] = useState(false);
    const [kpiForm, setKpiForm] = useState({ revenue_12m: '', revenue_potential_3y: '', full_time_employees: '', incremental_hiring: '', kpi_status: 'Grey (Not Started Yet)' });

    // Roadmap edit mode
    const [roadmapEditing, setRoadmapEditing] = useState(false);
    const [roadmapSaving, setRoadmapSaving] = useState(false);
    const [editedRoadmap, setEditedRoadmap] = useState<any>(null);

    // Deliverables
    const [deliverables, setDeliverables] = useState<any[]>([]);
    const [showDeliverables, setShowDeliverables] = useState(false);
    const [generatingDeliverables, setGeneratingDeliverables] = useState(false);
    const [selectedRoadmapDeliverable, setSelectedRoadmapDeliverable] = useState<any>(null);
    const [roadmapStatusFilter, setRoadmapStatusFilter] = useState<string>('all');

    // Expert sessions
    const [expertSessionsOpen, setExpertSessionsOpen] = useState(true);
    const [expertSessions, setExpertSessions] = useState<any[]>([]);
    const [loadingExpertSessions, setLoadingExpertSessions] = useState(false);
    const [showScheduleExpertModal, setShowScheduleExpertModal] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                await supabase.auth.getUser();
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
                // Fetch deliverables
                try {
                    const delResult = await api.getDeliverables(id);
                    if (delResult?.deliverables?.length > 0) {
                        setDeliverables(delResult.deliverables);
                        setShowDeliverables(true);
                    }
                } catch (delErr) {
                    console.error('[VPVMDetail] Error fetching deliverables:', delErr);
                }
                // Fetch expert sessions
                try {
                    const sessions = await api.getVentureMentorSessions(id);
                    setExpertSessions(sessions);
                } catch (msErr) {
                    console.error('[VPVMDetail] Error fetching expert sessions:', msErr);
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
            {(!readOnly || backPath) && (
                <button onClick={() => navigate(backPath || '/vpvm/dashboard')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    {backLabel || 'Back to portfolio'}
                </button>
            )}

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
                    <div className="flex items-center gap-2">
                        {!readOnly && (
                            <button
                                onClick={() => navigate(`/vpvm/dashboard/venture/${id}/details`)}
                                className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                View Details
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Section */}
            {!hideKPIs && (<>
            <div className="flex items-center justify-end mb-1">
                {readOnly ? null : kpiEditing ? (
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
                                            await api.updateKPIs(id, appUpdates);
                                        }

                                        // Refresh data
                                        const result = await api.getVenture(id);
                                        setVenture(result.venture);
                                        setKpiEditing(false);
                                    } catch (err: any) {
                                        console.error('Error saving KPIs:', err);
                                        alert(`Failed to save KPIs: ${err.message || 'Unknown error'}`);
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
            </>)}

            {/* Roadmap */}
            <SectionHeader
                icon={Sparkles}
                title="Roadmap"
                open={roadmapOpen}
                onToggle={() => setRoadmapOpen(!roadmapOpen)}
                action={
                    readOnly ? undefined :
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
                                            const result = await api.updateRoadmap(id, editedRoadmap);
                                            setRoadmapData(result.roadmap?.roadmap_data || editedRoadmap);
                                            setRoadmapEditing(false);
                                            setEditedRoadmap(null);
                                        } catch (err: any) {
                                            console.error('Error saving roadmap:', err);
                                            alert(`Failed to save roadmap: ${err.message || 'Unknown error'}`);
                                        } finally {
                                            setRoadmapSaving(false);
                                        }
                                    }}
                                    disabled={roadmapSaving}
                                    className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                >{roadmapSaving ? 'Saving...' : 'Save Changes'}</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={async () => {
                                        if (!id || generatingDeliverables) return;
                                        if (deliverables.length > 0) {
                                            setShowDeliverables(!showDeliverables);
                                            return;
                                        }
                                        setGeneratingDeliverables(true);
                                        try {
                                            const result = await api.generateDeliverables(id);
                                            if (result?.deliverables) {
                                                setDeliverables(result.deliverables);
                                                setShowDeliverables(true);
                                            }
                                        } catch (err) {
                                            console.error('Error generating deliverables:', err);
                                        } finally {
                                            setGeneratingDeliverables(false);
                                        }
                                    }}
                                    disabled={generatingDeliverables}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {generatingDeliverables ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    {generatingDeliverables ? 'Generating...' : showDeliverables ? 'Hide deliverables' : deliverables.length > 0 ? 'Show deliverables' : 'Generate deliverables'}
                                </button>
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
                                {showDeliverables && deliverables.length > 0 && (
                                    <select
                                        value={roadmapStatusFilter}
                                        onChange={e => setRoadmapStatusFilter(e.target.value)}
                                        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="pending">Not Started</option>
                                        <option value="in_progress">Work In Progress</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                )}
                            </div>
                        )
                    ) : null
                }
            />
            {roadmapOpen && (
                roadmapData ? (
                    <RoadmapGrid
                        roadmapData={roadmapEditing && editedRoadmap ? editedRoadmap : roadmapData}
                        editing={roadmapEditing}
                        readOnly={readOnly}
                        onUpdate={(key, field, value) => {
                            if (!editedRoadmap) return;
                            const updated = { ...editedRoadmap };
                            updated[key] = { ...updated[key], [field]: value };
                            setEditedRoadmap(updated);
                        }}
                        deliverables={roadmapStatusFilter === 'all' ? deliverables : deliverables.filter(d => d.status === roadmapStatusFilter)}
                        showDeliverables={readOnly ? deliverables.length > 0 : showDeliverables}
                        onDeliverableClick={(del) => setSelectedRoadmapDeliverable(del)}
                        onDeliverableStatusChange={async (deliverableId, newStatus) => {
                            if (!id) return;
                            try {
                                await api.updateDeliverableStatus(id, deliverableId, newStatus);
                                setDeliverables(prev => prev.map(d =>
                                    d.id === deliverableId ? { ...d, status: newStatus, ...(newStatus === 'in_progress' ? { health: d.health || 'on_track' } : {}) } : d
                                ));
                            } catch (err: any) {
                                console.error('Error updating deliverable:', err);
                                alert(`Failed to update status: ${err.message || 'Unknown error'}`);
                            }
                        }}
                        onDeliverableHealthChange={async (deliverableId, newHealth) => {
                            if (!id) return;
                            try {
                                await api.updateDeliverableStatus(id, deliverableId, undefined as any, newHealth);
                                setDeliverables(prev => prev.map(d =>
                                    d.id === deliverableId ? { ...d, health: newHealth } : d
                                ));
                            } catch (err: any) {
                                console.error('Error updating health:', err);
                                alert(`Failed to update health: ${err.message || 'Unknown error'}`);
                            }
                        }}
                    />) : readOnly ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                        <p className="text-sm text-gray-400">No roadmap generated yet.</p>
                    </div>
                ) : (
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


            {/* My Interactions Section */}
            <SectionHeader
                icon={Video}
                title="My Interactions"
                open={expertSessionsOpen}
                onToggle={() => {
                    setExpertSessionsOpen(!expertSessionsOpen);
                    if (!expertSessionsOpen && expertSessions.length === 0 && id) {
                        setLoadingExpertSessions(true);
                        api.getVentureMentorSessions(id).then(s => setExpertSessions(s)).catch(() => {}).finally(() => setLoadingExpertSessions(false));
                    }
                }}
            />
            {expertSessionsOpen && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    {loadingExpertSessions ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                            <span className="ml-2 text-sm text-gray-500">Loading sessions...</span>
                        </div>
                    ) : expertSessions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No sessions yet.</p>
                            {!readOnly && (
                                <button
                                    onClick={() => setShowScheduleExpertModal(true)}
                                    className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
                                >
                                    Schedule the first session
                                </button>
                            )}
                        </div>
                    ) : (
                        <SessionCardList sessions={expertSessions} venture={venture} navigate={navigate} />
                    )}
                </div>
            )}

            {/* Expert Interactions Section (disabled) */}
            <div className="opacity-50 pointer-events-none">
                <SectionHeader
                    icon={Video}
                    title="Expert Interactions"
                    open={false}
                    onToggle={() => {}}
                />
            </div>

            {/* Schedule Expert Session Modal */}
            {showScheduleExpertModal && id && venture && (
                <ScheduleExpertSessionModal
                    ventureId={id}
                    ventureName={venture.name}
                    founderName={venture.founder_name}
                    onClose={() => setShowScheduleExpertModal(false)}
                    onScheduled={() => {
                        setShowScheduleExpertModal(false);
                        setExpertSessionsOpen(true);
                        // Refresh sessions
                        api.getVentureMentorSessions(id).then(s => setExpertSessions(s)).catch(() => {});
                    }}
                />
            )}

            {/* Deliverable Detail Modal (from roadmap click) */}
            {selectedRoadmapDeliverable && id && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto">
                        <DeliverableDetail
                            ventureId={id}
                            deliverable={selectedRoadmapDeliverable}
                            ventureName={venture?.name || ''}
                            readOnly={readOnly}
                            onBack={() => {
                                setSelectedRoadmapDeliverable(null);
                                // Refresh deliverables to pick up any changes
                                api.getDeliverables(id).then(res => {
                                    if (res?.deliverables) setDeliverables(res.deliverables);
                                }).catch(() => {});
                            }}
                            onUpdate={(updated) => {
                                setDeliverables(prev => prev.map(d => d.id === updated.id ? updated : d));
                                setSelectedRoadmapDeliverable(updated);
                            }}
                        />
                    </div>
                </div>
            )}

        </div>
    );
};

/* ============ Session Card List with Inline Expansion ============ */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function getToken() {
    const { supabase: sb } = await import('../lib/supabase');
    return (await sb.auth.getSession()).data.session?.access_token || '';
}

const SessionCardList: React.FC<{ sessions: any[]; venture: any; navigate: any }> = ({ sessions, venture, navigate }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="space-y-2">
            {sessions.map((session: any) => (
                <div key={session.id}>
                    <div
                        className={`bg-white border border-gray-200 border-l-4 border-l-emerald-400 rounded-lg px-5 py-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all ${expandedId === session.id ? 'ring-2 ring-indigo-100 border-indigo-300' : ''}`}
                        onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                    {venture?.name || 'Venture'}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                                    {venture?.founder_name && (
                                        <span>with <span className="font-medium text-gray-700">{venture.founder_name}</span></span>
                                    )}
                                    {session.scheduled_date && (
                                        <>
                                            {venture?.founder_name && <span className="text-gray-300">·</span>}
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
                            <div className="flex items-center gap-2">
                                {session.status === 'ended' && (
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                                        ended
                                    </span>
                                )}
                                {session.join_url && session.status === 'scheduled' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); navigate(`/meeting/${session.id}`); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
                                    >
                                        <Video className="w-3.5 h-3.5" /> Join
                                    </button>
                                )}
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === session.id ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                    </div>
                    {expandedId === session.id && (
                        <SessionExpandedPanel sessionId={session.id} isUpcoming={session.status === 'scheduled'} />
                    )}
                </div>
            ))}
        </div>
    );
};

/* ============ Expanded Panel for a Session ============ */

type ExpandedTab = 'summary' | 'insights' | 'preBrief';

const SessionExpandedPanel: React.FC<{ sessionId: string; isUpcoming: boolean }> = ({ sessionId, isUpcoming }) => {
    const [tab, setTab] = useState<ExpandedTab>(isUpcoming ? 'preBrief' : 'summary');
    const [summary, setSummary] = useState<any>(null);
    const [brief, setBrief] = useState<any>(null);
    const [insights, setInsights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const headers = { Authorization: `Bearer ${token}` };
                const [summaryRes, briefRes, insightsRes] = await Promise.all([
                    fetch(`${API_URL}/api/sessions/${sessionId}/summary`, { headers }),
                    fetch(`${API_URL}/api/briefs/${sessionId}`, { headers }),
                    fetch(`${API_URL}/api/sessions/${sessionId}/insights`, { headers }),
                ]);
                if (cancelled) return;
                const summaryData = await summaryRes.json();
                const briefData = await briefRes.json();
                const insightsData = await insightsRes.json();
                if (summaryData.success) setSummary(summaryData.data);
                if (briefData.success && briefData.data) setBrief(briefData.data);
                setInsights(insightsData.data || insightsData.insights || []);
            } catch (err) {
                console.error('[SessionPanel] Fetch error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [sessionId]);

    const tabs: { key: ExpandedTab; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
        { key: 'summary', label: 'Transcript Summary', icon: <MessageSquare className="w-3.5 h-3.5" />, disabled: isUpcoming },
        { key: 'insights', label: 'Cumulative Insights', icon: <TrendingUp className="w-3.5 h-3.5" /> },
        { key: 'preBrief', label: 'Pre-Meeting Brief', icon: <Sparkles className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg px-5 py-4 space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
                {tabs.map(({ key, label, icon, disabled }) => (
                    <button
                        key={key}
                        onClick={() => !disabled && setTab(key)}
                        disabled={disabled}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                            disabled
                                ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                : tab === key
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {icon} {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
            ) : (
                <>
                    {tab === 'summary' && <ExpandedSummary summary={summary} />}
                    {tab === 'insights' && <ExpandedInsights insights={insights} />}
                    {tab === 'preBrief' && <ExpandedBrief brief={brief} />}
                </>
            )}
        </div>
    );
};

const ExpandedSummary: React.FC<{ summary: any }> = ({ summary }) => {
    if (!summary) return <p className="text-sm text-gray-500 text-center py-4">No meeting summary available yet.</p>;
    return (
        <div className="space-y-3">
            {summary.summary_text && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Session Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{summary.summary_text}</p>
                </div>
            )}
            {summary.key_points?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Key Points</p>
                    <div className="space-y-1">
                        {summary.key_points.map((point: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                                <span>{point}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {summary.action_items?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Action Items</p>
                    <div className="space-y-1">
                        {summary.action_items.map((item: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <CheckSquare className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                <span>{typeof item === 'string' ? item : item?.title || item?.description}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ExpandedInsights: React.FC<{ insights: any[] }> = ({ insights }) => {
    if (!insights || insights.length === 0) return <p className="text-sm text-gray-500 text-center py-4">No cumulative insights available.</p>;
    const sorted = [...insights].sort((a, b) => {
        if (a.is_final !== b.is_final) return a.is_final ? 1 : -1;
        return new Date(a.snapshot_time).getTime() - new Date(b.snapshot_time).getTime();
    });
    return (
        <div className="space-y-2">
            {sorted.map((ins: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ins.is_final ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                            {ins.is_final ? 'FINAL' : 'SNAPSHOT'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                            {new Date(ins.snapshot_time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <p className="text-xs text-gray-700">{ins.summary}</p>
                </div>
            ))}
        </div>
    );
};

const ExpandedBrief: React.FC<{ brief: any }> = ({ brief }) => {
    const content = brief?.brief_content;
    if (!content) return <p className="text-sm text-gray-500 text-center py-4">No pre-meeting brief generated for this session.</p>;
    return (
        <div className="space-y-3">
            {content.summary && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Overview</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{content.summary}</p>
                </div>
            )}
            {content.red_flags?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Red Flags</p>
                    <div className="space-y-1">
                        {content.red_flags.map((flag: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                                <span className="text-red-800">{flag}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {content.focus_areas?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Focus Areas</p>
                    <div className="space-y-1">
                        {content.focus_areas.map((area: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <Target className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                                <span>{area}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {content.key_questions?.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Key Questions</p>
                    <div className="space-y-1">
                        {content.key_questions.map((q: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <span>{q}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {content.progress_summary && (
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Progress</p>
                    <p className="text-xs text-gray-700">{content.progress_summary}</p>
                </div>
            )}
        </div>
    );
};
