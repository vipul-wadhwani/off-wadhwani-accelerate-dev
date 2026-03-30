import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatRevenue, formatEmployees } from '../utils/formatters';
import { STATUS_CONFIG } from '../components/StatusSelect';
import {
    Loader2,
    ArrowLeft,
    Users,
    TrendingUp,
    Briefcase,
    HelpCircle,
} from 'lucide-react';

export const VPVMApplicationDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [venture, setVenture] = useState<any>(null);
    const [streams, setStreams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const result = await api.getVenture(id);
                setVenture(result.venture);
                setStreams(result.streams || []);
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
                <button onClick={() => navigate(-1)} className="text-indigo-600 text-sm mt-2">Go back</button>
            </div>
        );
    }

    const programLabel = (venture.program_recommendation || '').toLowerCase().includes('prime') ? 'Accelerate Prime'
        : (venture.program_recommendation || '').toLowerCase().includes('core') ? 'Accelerate Core'
        : (venture.program_recommendation || '').toLowerCase().includes('select') ? 'Accelerate Select'
        : venture.program_recommendation || '';

    // Map streams to needs format
    const needs = streams.map((s: any) => ({ stream: s.stream_name, status: s.status }));

    const renderStreamStatus = (streamNames: string[]) => {
        const legacyMapping: Record<string, string> = {
            'Not started': 'Need some guidance',
            'Working on it': 'Need some guidance',
            'On track': "Don't need help",
            'Need some advice': 'Need some guidance',
            'Need guidance': 'Need some guidance',
            'Completed': "Don't need help",
            'Done': "Don't need help",
            'No help needed': "Don't need help",
        };

        return streamNames.map(stream => {
            const rawStatus = needs.find((n: any) =>
                n.stream === stream ||
                (stream === 'Go-To-Market (GTM)' && n.stream === 'GTM') ||
                (stream === 'Capital Planning' && (n.stream === 'Funding' || n.stream === 'Financial Planning')) ||
                (stream === 'Supply Chain' && n.stream === 'SupplyChain')
            )?.status || 'N/A';

            const mappedStatus = legacyMapping[rawStatus] || rawStatus;
            const normalizedStatus = Object.keys(STATUS_CONFIG).find(
                key => key.toLowerCase() === mappedStatus?.toLowerCase()
            ) || mappedStatus;

            const config = STATUS_CONFIG[normalizedStatus] || {
                icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-50', border: 'border-gray-200'
            };
            const Icon = config.icon;

            return (
                <div key={stream}>
                    <span className="text-sm font-semibold text-gray-900 block mb-2">{stream}</span>
                    <div className={`p-3 rounded-lg text-sm font-medium flex items-center gap-2 border ${config.bg} ${config.border} ${config.color}`}>
                        <Icon className="w-4 h-4" />
                        {normalizedStatus}
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="space-y-6">
            {/* Back button */}
            <button onClick={() => navigate(`/vpvm/dashboard/venture/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to venture
            </button>

            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{venture.name}</h1>
                        <p className="text-sm text-gray-500 mt-1">Application details and historical data</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-500">Read Only</span>
                </div>
            </div>

            {/* VSM Assessment Banner */}
            {venture.program_recommendation && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-purple-900">Screening Manager Assessment</p>
                        <p className="text-xs text-purple-700 mt-1">
                            This venture was assessed by the Screening Manager and recommended for {programLabel}.
                            {venture.vsm_reviewed_at && ` Reviewed on ${new Date(venture.vsm_reviewed_at).toLocaleDateString()}.`}
                        </p>
                    </div>
                </div>
            )}

            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Revenue</span>
                    <div className="text-xl font-bold text-gray-900">{formatRevenue(venture.revenue_12m)}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Incremental Revenue (3Y)</span>
                    <div className="text-xl font-bold text-gray-900">{formatRevenue(venture.revenue_potential_3y)}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Full Time Employees</span>
                    <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {(() => { const emp = formatEmployees(venture.full_time_employees); return <>{emp.total}{emp.breakdown && <span className="text-xs text-gray-400 block">{emp.breakdown}</span>}</>; })()}
                    </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Jobs</span>
                    <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {venture.target_jobs ?? 'N/A'}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Financial Condition</span>
                    <div className="text-sm font-semibold text-gray-900">{venture.financial_condition || 'N/A'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Owner Involvement</span>
                    <div className="text-sm font-semibold text-gray-900">{venture.time_commitment || 'N/A'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Leadership Team</span>
                    <div className="text-sm font-semibold text-gray-900">{venture.second_line_team || 'N/A'}</div>
                </div>
            </div>

            {/* Founder / Company Info */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-4">
                <div className="grid grid-cols-3 gap-6">
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
                        <span className="text-sm text-gray-600 block mb-1">Designation (Your role in the company)</span>
                        <div className="font-medium text-gray-900">{venture.founder_designation || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Company type:</span>
                        <div className="font-medium text-gray-900">{venture.company_type || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">Which city is your company primarily based in</span>
                        <div className="font-medium text-gray-900">{venture.city || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">State in which your company is located</span>
                        <div className="font-medium text-gray-900">{venture.state || 'N/A'}</div>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 block mb-1">How did I hear about us:</span>
                        <div className="font-medium text-gray-900">{venture.referred_by || 'N/A'}</div>
                    </div>
                </div>
            </div>

            {/* Current vs Target Business */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="p-6 pb-3">
                        <div className="flex items-center gap-2 text-gray-900 font-bold border-b border-gray-100 pb-3">
                            <Briefcase className="w-4 h-4 text-gray-400" />
                            Current Business
                        </div>
                    </div>
                    <div className="p-6 pb-3 bg-white">
                        <div className="flex items-center gap-2 text-blue-900 font-bold border-b border-blue-100 pb-3">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            New Venture
                        </div>
                    </div>
                </div>
                {[
                    { label: 'Product / Service', newLabel: 'New Product', current: venture.what_do_you_sell, target: venture.focus_product },
                    { label: 'Customer Segment', newLabel: 'New Segment', current: venture.who_do_you_sell_to, target: venture.focus_segment },
                    { label: 'Region', newLabel: 'New Region', current: venture.which_regions, target: venture.focus_geography },
                ].map((row, i) => (
                    <div key={i} className="grid grid-cols-2 divide-x divide-gray-100">
                        <div className="px-6 py-3">
                            <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">{row.label}</span>
                            <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[44px] flex items-center">{row.current || 'N/A'}</p>
                        </div>
                        <div className="px-6 py-3 bg-white">
                            <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">{row.newLabel}</span>
                            <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[44px] flex items-center shadow-sm shadow-blue-100/50">{row.target || 'N/A'}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Growth Idea Support Status */}
            <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Growth Idea Support Status</h2>
                <div className="grid grid-cols-3 gap-4">
                    {renderStreamStatus(['Product', 'Go-To-Market (GTM)', 'Capital Planning'])}
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                    {renderStreamStatus(['Supply Chain', 'Operations', 'Team'])}
                </div>
            </div>

            {/* Growth Focus */}
            {venture.growth_focus && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Growth Focus Areas</h2>
                    <div className="flex flex-wrap gap-2">
                        {(Array.isArray(venture.growth_focus) ? venture.growth_focus : [venture.growth_focus]).map((f: string, i: number) => (
                            <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200">{f}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Blockers & Support */}
            {(venture.blockers || venture.support_request) && (
                <div className="space-y-4">
                    {venture.blockers && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Blockers</h2>
                            <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-200">{venture.blockers}</p>
                        </div>
                    )}
                    {venture.support_request && (
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-2">Support Request</h2>
                            <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-200">{venture.support_request}</p>
                        </div>
                    )}
                </div>
            )}

            {/* VSM Notes */}
            {venture.vsm_notes && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Screening Manager Notes</h2>
                    <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-200">{venture.vsm_notes}</p>
                </div>
            )}

            {/* Screening SCALE Scorecard */}
            {venture.ai_analysis?.scorecard && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">Screening SCALE Scorecard <span className="text-xs text-gray-400 font-normal">Read Only</span></h2>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Dimension</th>
                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Assessment</th>
                                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-500 uppercase">Rating</th>
                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Brief</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {venture.ai_analysis.scorecard.map((item: any, i: number) => {
                                    const style = item.rating === 'Green' ? { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' } : item.rating === 'Red' ? { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' } : { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
                                    return (
                                        <tr key={i} className={style.bg}>
                                            <td className="px-4 py-3 font-semibold text-gray-800">{item.dimension}</td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">{item.assessment}</td>
                                            <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1.5 ${style.text} font-semibold text-xs`}><span className={`w-2 h-2 rounded-full ${style.dot}`}/>{item.rating}</span></td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">{item.brief}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Panel SCALE Scorecard */}
            {venture.panel_ai_analysis?.panel_scorecard && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">Panel SCALE Scorecard <span className="text-xs text-gray-400 font-normal">Read Only</span></h2>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Dimension</th>
                                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-500 uppercase">App Rating</th>
                                    <th className="text-center px-3 py-2 text-xs font-bold text-gray-500 uppercase">Panel Rating</th>
                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Brief</th>
                                    <th className="text-left px-4 py-2 text-xs font-bold text-gray-500 uppercase">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {venture.panel_ai_analysis.panel_scorecard.map((item: any, i: number) => {
                                    const rs = (r: string) => r === 'Green' ? 'text-green-700' : r === 'Red' ? 'text-red-700' : 'text-amber-700';
                                    const ds = (r: string) => r === 'Green' ? 'bg-green-500' : r === 'Red' ? 'bg-red-500' : 'bg-amber-500';
                                    return (
                                        <tr key={i}>
                                            <td className="px-4 py-3 font-semibold text-gray-800">{item.dimension}</td>
                                            <td className="px-3 py-3 text-center"><span className={`inline-flex items-center gap-1 text-xs font-semibold ${rs(item.application_rating || item.rating || '')}`}><span className={`w-1.5 h-1.5 rounded-full ${ds(item.application_rating || item.rating || '')}`}/>{item.application_rating || item.rating || '-'}</span></td>
                                            <td className="px-3 py-3 text-center">{item.panel_rating ? <span className={`inline-flex items-center gap-1 text-xs font-semibold ${rs(item.panel_rating)}`}><span className={`w-1.5 h-1.5 rounded-full ${ds(item.panel_rating)}`}/>{item.panel_rating}</span> : '-'}</td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">{item.panel_brief || item.brief || '-'}</td>
                                            <td className="px-4 py-3 text-gray-600 text-xs">{item.panel_remarks || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Panel Gate Questions */}
            {venture.gate_questions?.gate_questions && (
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">Panel Gate Questions <span className="text-xs text-gray-400 font-normal">Read Only</span></h2>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
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
        </div>
    );
};
