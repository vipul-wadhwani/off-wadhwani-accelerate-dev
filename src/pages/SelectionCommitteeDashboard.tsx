import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingUp, Loader2, Briefcase, Users, Target, AlertTriangle, HelpCircle, Map, ChevronRight, Zap, CheckCircle, FileText, ChevronUp, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { InteractionsSection } from '../components/Interactions/InteractionsSection';
import { STATUS_CONFIG } from '../components/StatusSelect';

interface Venture {
    id: string;
    name: string;
    city: string;
    location: string;
    status: string;
    program_recommendation: string;
    revenue_12m: number;
    revenue_potential_3y: number;
    full_time_employees: number;
    founder_name?: string;
    growth_current?: any;
    commitment?: any;
    needs: { id?: string; stream: string; status: string }[];
    streams?: any[];
    created_at: string;
    vsm_reviewed_at: string;
    vsm_notes?: string;
    internal_comments?: string;
    ai_analysis?: any;
    growth_target?: any;
    incremental_hiring?: string;
    venture_partner?: string;
    workbench_locked?: boolean;
}

const OtherDetailsReadOnlySection: React.FC<{ selectedVenture: any }> = ({ selectedVenture }) => {
    const [open, setOpen] = useState(true);
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
                <span className="text-base font-bold text-gray-700">Other support details the venture is seeking from the program</span>
                <div className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:border-gray-400 transition-colors">
                    {open ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
            </button>
            {open && (
                <div className="px-6 pb-6 space-y-4">
                    {/* Venture's Support Request from Application Form */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                            Support Description (from application)
                        </label>
                        <div className="w-full min-h-[120px] rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                            {selectedVenture.support_request || 'No support description provided'}
                        </div>
                    </div>

                    {/* VSM Notes (Read-only) */}
                    {selectedVenture.vsm_notes && (
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                                Screening Manager Notes
                            </label>
                            <div className="w-full min-h-[120px] rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                                {selectedVenture.vsm_notes}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const SelectionCommitteeDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [ventures, setVentures] = useState<Venture[]>([]);
    const [selectedVenture, setSelectedVenture] = useState<Venture | null>(null);
    const [loading, setLoading] = useState(true);
    const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
    const [roadmapGenerated, setRoadmapGenerated] = useState(false);
    const [savingCommitment, setSavingCommitment] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any | null>(null);

    useEffect(() => {
        if (user) {
            fetchVentures();
        }
    }, [user]);

    const fetchVentures = async () => {
        try {
            // Fetch all ventures with program_recommendation = "Accelerate Core" or "Accelerate Select"
            const { ventures: allVentures } = await api.getVentures({});

            console.log('🔍 All ventures:', allVentures);
            console.log('🔍 Venture recommendations:', allVentures?.map((v: any) => ({
                name: v.name,
                program_recommendation: v.program_recommendation,
                matches: ['Accelerate Core', 'Accelerate Select'].includes(v.program_recommendation)
            })));

            // Filter for Core and Select programs only
            const accelerateVentures = allVentures?.filter(
                (v: Venture) => ['Accelerate Core', 'Accelerate Select'].includes(v.program_recommendation || '')
            ) || [];

            console.log('✅ Filtered Accelerate ventures (Core & Select):', accelerateVentures);

            // Map ventures to ensure needs array exists
            const mappedVentures = accelerateVentures.map((v: any) => ({
                ...v,
                needs: (v.streams || v.needs || []).map((s: any) => ({
                    id: s.id,
                    stream: s.stream_name,
                    status: s.status
                }))
            }));

            setVentures(mappedVentures);
        } catch (err) {
            console.error('Error fetching ventures:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleVentureSelect = async (venture: Venture) => {
        // Optimistically set selected to show UI immediately
        setSelectedVenture(venture);
        setRoadmapGenerated(false); // Reset roadmap when selecting new venture
        setAnalysisResult(null);

        // Fetch fresh details with streams
        try {
            const { venture: freshVenture, streams } = await api.getVenture(venture.id);

            // Map streams to needs format
            const mappedNeeds = (streams || []).map((s: any) => ({
                id: s.id,
                stream: s.stream_name,
                status: s.status
            }));

            const fullVenture = {
                ...freshVenture,
                needs: mappedNeeds
            };

            setSelectedVenture(fullVenture);
            setAnalysisResult(freshVenture.ai_analysis || null);
        } catch (error) {
            console.error('Error fetching venture details:', error);
        }
    };

    const runAIAnalysis = async () => {
        if (!selectedVenture) return;
        setAnalyzing(true);

        try {
            const result = await api.generateInsights(selectedVenture.id);
            const insights = result.insights || result;

            setAnalysisResult(insights);
            setVentures(prev => prev.map(v =>
                v.id === selectedVenture.id ? { ...v, ai_analysis: insights } : v
            ));
        } catch (error: any) {
            console.error('Error generating AI insights:', error);
            alert(error.message || 'Failed to generate AI insights.');
        } finally {
            setAnalyzing(false);
        }
    };

    const generateRoadmap = async () => {
        if (!selectedVenture) return;

        setGeneratingRoadmap(true);

        // Simulate AI roadmap generation (2 seconds)
        setTimeout(() => {
            setGeneratingRoadmap(false);
            setRoadmapGenerated(true);
        }, 2000);
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!selectedVenture) return;

        setSavingCommitment(true);

        try {
            const updatePayload: any = {
                status: newStatus,
                venture_partner: user?.email || 'Panel (Core, Select)',
            };

            // If status is Contract Sent, lock the workbench
            if (newStatus === 'Contract Sent') {
                updatePayload.workbench_locked = true;
            }

            await api.updateVenture(selectedVenture.id, updatePayload);

            // Update local state
            setVentures(prev => prev.map(v =>
                v.id === selectedVenture.id
                    ? { ...v, status: newStatus }
                    : v
            ));

            setSelectedVenture(prev => prev ? { ...prev, status: newStatus } : null);

            // Show workbench lock notification if contract sent
            if (newStatus === 'Contract Sent') {
                alert(`✓ Status updated to: ${newStatus}\n\n🔒 Workbench has been locked. The venture will be notified to take action.`);
            }
        } catch (error: any) {
            console.error('Error updating venture status:', error);
            alert('Failed to update status: ' + error.message);
        } finally {
            setSavingCommitment(false);
        }
    };

    const [revenueFilter, setRevenueFilter] = useState<string>('all');

    const filteredVentures = ventures.filter(v => {
        if (revenueFilter === 'all') return true;
        return String(v.revenue_12m) === revenueFilter;
    });

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

            {/* MASTER VIEW: Venture List */}
            {!selectedVenture ? (
                <div className="space-y-4">
                    {/* Column Headers - always visible */}
                    <div className="grid grid-cols-12 gap-4 px-8 pb-4 border-b border-gray-200 items-end">
                        <div className="col-span-5">
                            <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Venture</span>
                        </div>
                        <div className="col-span-2 text-center">
                            <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Submitted</span>
                        </div>
                        <div className="col-span-3 text-center">
                            <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Program</span>
                        </div>
                        <div className="col-span-2 text-right">
                            <select
                                value={revenueFilter}
                                onChange={(e) => setRevenueFilter(e.target.value)}
                                className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
                            >
                                <option value="all">Revenue</option>
                                <option value="1Cr-5Cr">1Cr - 5Cr</option>
                                <option value="5Cr-25Cr">5Cr - 25Cr</option>
                                <option value="25Cr-75Cr">25Cr - 75Cr</option>
                                <option value=">75Cr">&gt;75Cr</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-16 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                            <span className="text-sm text-gray-400">Loading applications...</span>
                        </div>
                    ) : filteredVentures.length === 0 ? (
                        <div className="text-center p-16 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
                            <div className="text-lg font-medium mb-1">No applications found</div>
                            <div className="text-sm">Ventures recommended for Accelerate Core or Select will appear here.</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                                {filteredVentures.map(v => (
                                    <div
                                        key={v.id}
                                        onClick={() => handleVentureSelect(v)}
                                        className="bg-white rounded-2xl border border-gray-200 hover:border-purple-400 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer px-8 py-6 grid grid-cols-12 gap-4 items-center group"
                                    >
                                        {/* Venture Info */}
                                        <div className="col-span-5 space-y-1.5">
                                            <h2 className="text-[17px] font-semibold text-gray-900 leading-snug group-hover:text-purple-600 transition-colors">
                                                {v.name}
                                            </h2>
                                            <div className="flex items-center gap-2 text-gray-500 text-[13px]">
                                                <Target className="w-3.5 h-3.5 text-gray-400" />
                                                {v.location || v.city || 'Location not provided'}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[13px] text-gray-400">
                                                <Users className="w-3.5 h-3.5" />
                                                {v.founder_name || 'Founder not listed'}
                                            </div>
                                        </div>

                                        {/* Date of Submission */}
                                        <div className="col-span-2 text-center border-l border-gray-100 pl-4">
                                            <div className="text-[14px] font-medium text-gray-600">
                                                {v.created_at ? new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ /g, '-') : 'N/A'}
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div className="col-span-3 text-center border-l border-gray-100 pl-4">
                                            <span className={`inline-block px-4 py-1.5 rounded-full text-[13px] font-semibold ${v.program_recommendation
                                                ? 'bg-purple-50 text-purple-700'
                                                : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                {v.program_recommendation || 'Awaiting review'}
                                            </span>
                                        </div>

                                        {/* Revenue & Arrow */}
                                        <div className="col-span-2 flex items-center justify-end gap-3 border-l border-gray-100 pl-4">
                                            <div className="text-right">
                                                <div className="text-[15px] font-semibold text-gray-800 whitespace-nowrap">
                                                    {v.revenue_12m ? `₹${v.revenue_12m} Cr` : '--'}
                                                </div>
                                            </div>
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 group-hover:bg-purple-600 group-hover:text-white transition-all duration-200 flex-shrink-0">
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                    )}
                </div>
            ) : (
                /* DETAIL VIEW: Same as Panel (Prime) Dashboard */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Back Button */}
                    <div className="border-b border-gray-100 px-6 py-3 bg-gray-50">
                        <Button variant="ghost" onClick={() => setSelectedVenture(null)} className="text-gray-500 hover:text-gray-900 w-auto px-3 py-2 h-auto text-sm">
                            ← Back to Ventures
                        </Button>
                    </div>

                    {/* Header: Company Name Left, Status Right */}
                    <div className="border-b border-gray-100 px-6 py-5 bg-white flex items-center justify-between sticky top-0 z-20">
                        <h2 className="text-2xl font-bold text-gray-900">{selectedVenture.name}</h2>
                        <span className="px-4 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm font-bold">
                            {selectedVenture.status}
                        </span>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* VSM Assessment Info Banner */}
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-indigo-900">Screening Manager Assessment</p>
                                <p className="text-xs text-indigo-700 mt-1">
                                    This venture was assessed by the Screening Manager and recommended for {selectedVenture.program_recommendation}.
                                    {selectedVenture.vsm_reviewed_at && ` Reviewed on ${new Date(selectedVenture.vsm_reviewed_at).toLocaleDateString()}.`}
                                </p>
                            </div>
                        </div>

                        {/* Dashboard Metrics */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Revenue</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    <span className="text-sm text-gray-400">₹</span>
                                    {selectedVenture.revenue_12m || '0'}<span className="text-sm text-gray-400 ml-0.5">Cr</span>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Revenue (3Y)</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    <span className="text-sm text-gray-400">₹</span>
                                    {selectedVenture.revenue_potential_3y || '0'}<span className="text-sm text-gray-400 ml-0.5">Cr</span>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Full Time Employees</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    {selectedVenture.full_time_employees || '0'}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Jobs</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    {(() => {
                                        const rev = String(selectedVenture.revenue_potential_3y || '');
                                        if (rev === '5Cr - 15 Cr') return '5';
                                        if (rev === '15Cr - 50Cr') return '20';
                                        if (rev === '50Cr+') return '30';
                                        const num = parseFloat(rev);
                                        if (!isNaN(num)) {
                                            if (num < 15) return '5';
                                            if (num < 50) return '20';
                                            return '30';
                                        }
                                        return '0';
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Venture Context */}
                        <div>
                            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 mb-6 space-y-4">
                                <div className="grid grid-cols-3 gap-6">
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">Name: <span className="font-semibold text-gray-900">{selectedVenture.founder_name || 'N/A'}</span></span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">Mobile: <span className="font-semibold text-gray-900">{(selectedVenture as any).founder_phone || 'N/A'}</span></span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">Email: <span className="font-semibold text-gray-900">{(selectedVenture as any).founder_email || 'N/A'}</span></span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">Registered company name</span>
                                        <div className="font-medium text-gray-900">{selectedVenture.name || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">Designation (Your role in the company)</span>
                                        <div className="font-medium text-gray-900">{(selectedVenture as any).founder_designation || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">Company type:</span>
                                        <div className="font-medium text-gray-900">{(selectedVenture as any).company_type || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">Which city is your company primarily based in</span>
                                        <div className="font-medium text-gray-900">{selectedVenture.city || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">State in which your company is located</span>
                                        <div className="font-medium text-gray-900">{(selectedVenture as any).state || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600 block mb-1">How did I hear about us:</span>
                                        <div className="font-medium text-gray-900">{(selectedVenture as any).referred_by || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Current vs Target Business */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="grid grid-cols-2 divide-x divide-gray-100">
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 text-gray-900 font-bold border-b border-gray-100 pb-3 mb-4">
                                            <Briefcase className="w-4 h-4 text-gray-400" />
                                            Current Business
                                        </div>
                                        <div className="space-y-5">
                                            <div>
                                                <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Product / Service</span>
                                                <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[44px] flex items-center">{(selectedVenture as any).what_do_you_sell || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Customer Segment</span>
                                                <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[44px] flex items-center">{(selectedVenture as any).who_do_you_sell_to || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Region</span>
                                                <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[44px] flex items-center">{(selectedVenture as any).which_regions || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-white">
                                        <div className="flex items-center gap-2 text-blue-900 font-bold border-b border-blue-100 pb-3 mb-4">
                                            <TrendingUp className="w-4 h-4 text-blue-600" />
                                            New Venture
                                        </div>
                                        <div className="space-y-5">
                                            <div>
                                                <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Product</span>
                                                <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[44px] flex items-center shadow-sm shadow-blue-100/50">{(selectedVenture as any).focus_product || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Segment</span>
                                                <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[44px] flex items-center shadow-sm shadow-blue-100/50">{(selectedVenture as any).focus_segment || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Region</span>
                                                <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[44px] flex items-center shadow-sm shadow-blue-100/50">{(selectedVenture as any).focus_geography || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Growth Idea Support Status */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                Growth Idea Support Status
                            </h2>
                            <div className="grid grid-cols-3 gap-4">
                                {/* Row 1 */}
                                {['Product', 'Go-To-Market (GTM)', 'Capital Planning'].map(stream => {
                                    const rawStatus = selectedVenture.needs.find((n: any) =>
                                        n.stream === stream ||
                                        (stream === 'Go-To-Market (GTM)' && n.stream === 'GTM') ||
                                        (stream === 'Capital Planning' && n.stream === 'Funding')
                                    )?.status || 'N/A';

                                    const legacyMapping: Record<string, string> = {
                                        'Not started': 'Need some guidance',
                                        'Working on it': 'Need some guidance',
                                        'On track': "Don't need help",
                                        'Need some advice': 'Need some guidance',
                                        'Need guidance': 'Need some guidance',
                                        'Completed': "Don't need help",
                                        'Done': "Don't need help",
                                        'No help needed': "Don't need help"
                                    };

                                    const mappedStatus = legacyMapping[rawStatus] || rawStatus;
                                    const normalizedStatus = Object.keys(STATUS_CONFIG).find(
                                        key => key.toLowerCase() === mappedStatus?.toLowerCase()
                                    ) || mappedStatus;

                                    const config = STATUS_CONFIG[normalizedStatus] || {
                                        icon: HelpCircle,
                                        color: 'text-gray-400',
                                        bg: 'bg-gray-50',
                                        border: 'border-gray-200'
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
                                })}
                            </div>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                {/* Row 2 */}
                                {['Supply Chain', 'Operations', 'Team'].map(stream => {
                                    const rawStatus = selectedVenture.needs.find((n: any) =>
                                        n.stream === stream ||
                                        (stream === 'Supply Chain' && n.stream === 'SupplyChain')
                                    )?.status || 'N/A';

                                    const legacyMapping: Record<string, string> = {
                                        'Not started': 'Need some guidance',
                                        'Working on it': 'Need some guidance',
                                        'On track': "Don't need help",
                                        'Need some advice': 'Need some guidance',
                                        'Need guidance': 'Need some guidance',
                                        'Completed': "Don't need help",
                                        'Done': "Don't need help",
                                        'No help needed': "Don't need help"
                                    };

                                    const mappedStatus = legacyMapping[rawStatus] || rawStatus;
                                    const normalizedStatus = Object.keys(STATUS_CONFIG).find(
                                        key => key.toLowerCase() === mappedStatus?.toLowerCase()
                                    ) || mappedStatus;

                                    const config = STATUS_CONFIG[normalizedStatus] || {
                                        icon: HelpCircle,
                                        color: 'text-gray-400',
                                        bg: 'bg-gray-50',
                                        border: 'border-gray-200'
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
                                })}
                            </div>
                        </div>

                        {/* Company Document */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                Company Document
                            </h2>
                            <div className="bg-white border border-gray-200 rounded-xl p-6">
                                <p className="text-sm text-gray-600 mb-4">
                                    Corporate presentation uploaded by the venture (screening manager can download)
                                </p>
                                {(selectedVenture as any).document_url || (selectedVenture as any).corporate_presentation_url ? (
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            <span className="text-sm font-medium text-gray-900">
                                                {(selectedVenture as any).document_name || 'Corporate Presentation.pdf'}
                                            </span>
                                        </div>
                                        <a
                                            href={(selectedVenture as any).document_url || (selectedVenture as any).corporate_presentation_url}
                                            download
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-semibold"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Download
                                        </a>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">No document uploaded</p>
                                            <p className="text-xs text-gray-500 mt-1">The venture did not upload a corporate presentation</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Other Support Details */}
                        <OtherDetailsReadOnlySection selectedVenture={selectedVenture} />

                        {/* AI Analysis */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-indigo-500" />
                                    <span className="text-base font-bold text-gray-700">Generate AI insights</span>
                                    {analysisResult && !analyzing && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-600">
                                            <Sparkles className="w-3 h-3" />
                                            AI Generated
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={runAIAnalysis}
                                    disabled={analyzing}
                                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-sm"
                                >
                                    {analyzing ? (<><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>) : (<><Sparkles className="w-4 h-4" /> Generate insights</>)}
                                </button>
                            </div>
                            {!analysisResult && !analyzing && (
                                <div className="py-10 flex flex-col items-center gap-2 text-gray-300">
                                    <Sparkles className="w-10 h-10" />
                                    <p className="text-sm">Click "Generate insights" to analyse this venture</p>
                                </div>
                            )}
                            {analyzing && (
                                <div className="py-10 flex flex-col items-center gap-2 text-indigo-400">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <p className="text-sm font-medium">Analysing venture data...</p>
                                </div>
                            )}
                            {analysisResult && !analyzing && (
                                <div className="grid grid-cols-3 divide-x divide-gray-100">
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <TrendingUp className="w-4 h-4 text-green-500" />
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">PROS</span>
                                        </div>
                                        <ul className="space-y-2">
                                            {(analysisResult.strengths || []).map((s: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">CONS</span>
                                        </div>
                                        <ul className="space-y-2">
                                            {(analysisResult.risks || []).map((r: string, i: number) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                                    {r}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 mb-4">
                                            <HelpCircle className="w-4 h-4 text-blue-500" />
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Probing Questions</span>
                                        </div>
                                        <ol className="space-y-2 list-decimal list-inside">
                                            {(analysisResult.questions || []).map((q: string, i: number) => (
                                                <li key={i} className="text-sm text-gray-700">{q}</li>
                                            ))}
                                        </ol>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Program Recommendation */}
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Briefcase className="w-5 h-5 text-gray-400" />
                                <span className="text-base font-bold text-gray-700">Program Recommendation</span>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-indigo-700">Recommended Program:</span>
                                    <span className="text-lg font-bold text-indigo-900">{selectedVenture.program_recommendation}</span>
                                </div>
                                {selectedVenture.internal_comments && (
                                    <div className="mt-3 pt-3 border-t border-indigo-200">
                                        <span className="text-xs font-bold text-indigo-600 uppercase block mb-2">Internal Comments</span>
                                        <p className="text-sm text-indigo-800 whitespace-pre-wrap">{selectedVenture.internal_comments}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Interactions Section */}
                        <InteractionsSection ventureId={selectedVenture.id} />

                        {/* Journey Roadmap */}
                        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-200 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                        <Sparkles className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Generate Journey Roadmap</h2>
                                        <p className="text-sm text-indigo-600 font-semibold flex items-center gap-1.5">
                                            <Zap className="w-3.5 h-3.5" />
                                            Uses AI Insights
                                        </p>
                                    </div>
                                </div>
                                {!roadmapGenerated && (
                                    <button
                                        onClick={generateRoadmap}
                                        disabled={generatingRoadmap}
                                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                    >
                                        {generatingRoadmap ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                Generate Roadmap
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {roadmapGenerated ? (
                                <>
                                    <div className="mb-8 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-semibold text-green-900">AI-powered roadmap generated successfully</p>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-8 uppercase tracking-wider font-semibold">Deliverables & Milestones</p>
                                </>
                            ) : (
                                <div className="py-12 text-center">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
                                        <Map className="w-10 h-10 text-indigo-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">AI-Powered Journey Roadmap</h3>
                                    <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                                        Generate a personalized roadmap with deliverables and milestones across all six streams using AI insights from the Screening Manager's assessment.
                                    </p>
                                </div>
                            )}

                            {roadmapGenerated && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Product */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Product</h3>
                                            <ChevronRight className="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Core API Specs</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Technical specifications for public and internal endpoints.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">UI Design System</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Global Figma library and component standards.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">V1.2 Integration</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Middleware bridge for legacy data retrofitting.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Infrastructure</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Multi-region cloud deployment strategy.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Unit Testing</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Standardized QA suite for core services.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Security Audit</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Third-party penetration testing and compliance.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* GTM */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">GTM</h3>
                                            <ChevronRight className="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">ICP Definition</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Detailed profile of high-value manufacturing clients.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Distribution</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Partner channel mapping and commission structures.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Referral Program</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Incentive model for existing customer advocacy.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Partner Ecosystem</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Integration directory for third-party providers.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Pricing Strategy</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Tiered subscription and volume discount model.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Sales Launch</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Regional enablement kit for direct sales teams.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Funding */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Funding</h3>
                                            <ChevronRight className="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Series A Pitch</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Updated narrative for institutional growth rounds.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Financial Metrics</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Historical performance and 24-month projections.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Data Room</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Encrypted document repository for due diligence.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Investor Outreach</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">CRM tracking for potential VC partners.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Financial Model</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Excel-based dynamic budget and burn calculator.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Exit Strategy</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">M&A landscape analysis and valuation benchmarks.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Supply Chain */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Supply Chain</h3>
                                            <ChevronRight className="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Lead Time Gap</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Analysis of hardware delays vs scaling targets.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Vendor Review</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Quarterly performance scorecard for key suppliers.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Inventory Forecast</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">AI-driven predictive stock requirements.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Logistics Audit</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Freight cost optimization and route analysis.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Compliance Review</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Regulatory certification status for global trade.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Safety Stock</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Buffering strategy for mission-critical components.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Operations */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Operations</h3>
                                            <ChevronRight className="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">ERP Integration</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Centralized management of ops and finance.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Team Training</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Internal platform for onboarding new staff.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Automation</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Standardization of routine warehouse tasks.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Office Expansion</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Real estate planning for the EMEA headquarters.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Compliance Audit</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Internal review of data privacy and safety.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Disaster Recovery</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Backup protocols and emergency business plan.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Team */}
                                    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Team</h3>
                                            <ChevronRight className="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Hiring Handbook</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Standardized interview and offer procedures.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Appraisal Framework</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Semi-annual performance review methodology.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Individual Metrics</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">KPI dashboards for all department leads.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Equity Program</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Option pool allocation and vesting schedules.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Culture Workshop</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Mission alignment for remote global teams.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0 mt-2" />
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Benefits Overhaul</p>
                                                    <p className="text-xs text-gray-500 italic mt-0.5">Comparison study of regional health plans.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Panel Feedback Button */}
                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={() => navigate(`/committee/dashboard/panel-feedback/${selectedVenture.id}`)}
                                className="px-6 py-3 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                            >
                                Next: Panel Feedback
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
