import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Users, Briefcase, TrendingUp, FileText,
    AlertTriangle, Sparkles, Target, HelpCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { formatRevenue, formatEmployees } from '../utils/formatters';
import { STATUS_CONFIG } from '../components/StatusSelect';
import { PanelFeedbackReadOnly } from '../components/PanelFeedbackReadOnly';
import { useToast } from '../components/ui/Toast';

function displayProgram(rec?: string): string {
    if (!rec) return '';
    if (rec.toLowerCase().includes('prime')) return 'Accelerate Prime';
    if (rec.toLowerCase().includes('core') || rec.toLowerCase().includes('select')) return 'Accelerate Core/Select';
    if (rec.toLowerCase().includes('selfserve')) return 'Self-Serve';
    return rec;
}

export const AdminApplicationDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [venture, setVenture] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const { venture: full, streams } = await api.getVenture(id);
                const mappedNeeds = (streams || []).map((s: any) => ({
                    id: s.id,
                    stream: s.stream_name || '',
                    status: s.status || 'N/A',
                }));
                let panelFeedback = null;
                try {
                    const { data: pfData } = await supabase
                        .from('panel_feedback')
                        .select('*')
                        .eq('venture_id', id)
                        .order('created_at', { ascending: false })
                        .limit(1);
                    panelFeedback = pfData?.[0] || null;
                } catch { /* no panel feedback */ }

                if (!cancelled) {
                    setVenture({ ...(full || {}), needs: mappedNeeds, panel_feedback: panelFeedback });
                }
            } catch (err) {
                console.error('Error fetching venture profile:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [id]);

    if (loading || !venture) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-5">
            {/* Back button */}
            <button
                onClick={() => navigate('/admin/dashboard')}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Application Dashboard
            </button>

            {/* Page Header */}
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-4">
                <h1 className="text-2xl font-bold text-gray-900">{venture.name || 'Unknown Venture'}</h1>
                {venture.program_recommendation && (
                    <span className="inline-flex items-center px-3 py-1 mt-2 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                        {displayProgram(venture.program_recommendation)}
                    </span>
                )}
            </div>

            {/* Screening Manager Assessment Banner */}
            {venture.program_recommendation && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-indigo-900">Screening Manager Assessment</p>
                        <p className="text-xs text-indigo-700 mt-1">
                            This venture was assessed and recommended for {displayProgram(venture.program_recommendation)}.
                            {venture.vsm_reviewed_at && ` Reviewed on ${new Date(venture.vsm_reviewed_at).toLocaleDateString()}.`}
                        </p>
                    </div>
                </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Revenue</span>
                    <div className="text-lg font-bold text-gray-900">{formatRevenue(venture.revenue_12m)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Incremental Revenue (3Y)</span>
                    <div className="text-lg font-bold text-gray-900">{formatRevenue(venture.revenue_potential_3y)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Employees</span>
                    <div className="text-lg font-bold text-gray-900 flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {(() => { const emp = formatEmployees(venture.full_time_employees); return <>{emp.total}{emp.breakdown && <span className="text-xs text-gray-400 block">{emp.breakdown}</span>}</>; })()}
                    </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Jobs</span>
                    <div className="text-lg font-bold text-gray-900 flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {venture.target_jobs ?? 'N/A'}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Financial Condition</span>
                    <div className="text-sm font-semibold text-gray-900">{venture.financial_condition || 'N/A'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Owner Involvement</span>
                    <div className="text-sm font-semibold text-gray-900">{venture.time_commitment || 'N/A'}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Leadership Team</span>
                    <div className="text-sm font-semibold text-gray-900">{venture.second_line_team || 'N/A'}</div>
                </div>
            </div>

            {/* Founder / Company Info */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Name: <span className="font-semibold text-gray-900">{venture.founder_name || 'N/A'}</span></span>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Mobile: <span className="font-semibold text-gray-900">{venture.founder_phone || 'N/A'}</span></span>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Email: <span className="font-semibold text-gray-900">{venture.founder_email || 'N/A'}</span></span>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Registered company name</span>
                        <div className="font-medium text-gray-900">{venture.name || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Designation</span>
                        <div className="font-medium text-gray-900">{venture.founder_designation || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Company type</span>
                        <div className="font-medium text-gray-900">{venture.company_type || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">City</span>
                        <div className="font-medium text-gray-900">{venture.city || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">State</span>
                        <div className="font-medium text-gray-900">{venture.state || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">How did I hear about us</span>
                        <div className="font-medium text-gray-900">{venture.referred_by || 'N/A'}</div>
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
                        <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[40px] flex items-center">{venture.what_do_you_sell || 'N/A'}</p>
                    </div>
                    <div className="px-5 py-3 bg-white">
                        <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Product</span>
                        <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[40px] flex items-center shadow-sm shadow-blue-100/50">{venture.focus_product || 'N/A'}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="px-5 py-3">
                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Customer Segment</span>
                        <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[40px] flex items-center">{venture.who_do_you_sell_to || 'N/A'}</p>
                    </div>
                    <div className="px-5 py-3 bg-white">
                        <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Segment</span>
                        <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[40px] flex items-center shadow-sm shadow-blue-100/50">{venture.focus_segment || 'N/A'}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="px-5 py-3 pb-5">
                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Region</span>
                        <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[40px] flex items-center">{venture.which_regions || 'N/A'}</p>
                    </div>
                    <div className="px-5 py-3 pb-5 bg-white">
                        <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Region</span>
                        <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[40px] flex items-center shadow-sm shadow-blue-100/50">{venture.focus_geography || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Support Request from Application */}
            {venture.support_request && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-base font-bold text-gray-900 mb-3">Support Description (from application)</h3>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">{venture.support_request}</p>
                </div>
            )}

            {/* Growth Idea Support Status */}
            <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">Growth Idea Support Status</h3>
                <div className="grid grid-cols-3 gap-3">
                    {['Product', 'Go-To-Market (GTM)', 'Capital Planning'].map(stream => {
                        const rawStatus = (venture.needs || []).find((n: any) =>
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
                        const rawStatus = (venture.needs || []).find((n: any) =>
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
                    {venture.corporate_presentation_url ? (
                        <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <FileText className="w-5 h-5 text-blue-600" />
                                <span className="text-sm font-medium text-gray-900">
                                    {venture.corporate_presentation_url.split('/').pop()?.replace(/^\d+_/, '') || 'Corporate Presentation'}
                                </span>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        const url = await api.getVentureDocumentUrl(venture.corporate_presentation_url);
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
            {venture.program_recommendation && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Briefcase className="w-5 h-5 text-gray-400" />
                        <span className="text-base font-bold text-gray-700">Program Recommendation</span>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-indigo-700">Recommended Program:</span>
                            <span className="text-lg font-bold text-indigo-900">{displayProgram(venture.program_recommendation)}</span>
                        </div>
                        {venture.internal_comments && (
                            <div className="mt-3 pt-3 border-t border-indigo-200">
                                <span className="text-xs font-bold text-indigo-600 uppercase block mb-2">Internal Comments</span>
                                <p className="text-sm text-indigo-800 whitespace-pre-wrap">{venture.internal_comments}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Screening SCALE Scorecard (Read-only) */}
            {venture.ai_analysis?.scorecard && (
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
                                {venture.ai_analysis.scorecard.map((item: any, i: number) => {
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
            {venture.panel_ai_analysis?.panel_scorecard && (
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
                                    {venture.panel_ai_analysis.panel_scorecard.some((item: any) => item.panel_remarks) && (
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {venture.panel_ai_analysis.panel_scorecard.map((item: any, i: number) => {
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
                                            {venture.panel_ai_analysis.panel_scorecard.some((it: any) => it.panel_remarks) && (
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
            {venture.gate_questions?.gate_questions && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <span className="text-base font-bold text-gray-700">Panel Gate Questions</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {venture.gate_questions.gate_questions.map((gq: any, i: number) => (
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

            {/* Panel Feedback (Full Read-Only) */}
            {venture.panel_feedback && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-500" />
                        <span className="text-base font-bold text-gray-700">Panel Feedback</span>
                        <span className="text-xs text-gray-400">Read Only</span>
                    </div>
                    <div className="p-5">
                        <PanelFeedbackReadOnly data={venture.panel_feedback} />
                    </div>
                </div>
            )}
        </div>
    );
};
