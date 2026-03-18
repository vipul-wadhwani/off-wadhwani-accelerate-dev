import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
    Briefcase,
    ChevronRight,
    Edit3,
    Loader2,
    Save,
    Sparkles,
    Target,
    TrendingUp,
    Users,
    ChevronUp,
    AlertTriangle,
    HelpCircle,
    Plus,
    FileText,
    Pencil
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { STATUS_CONFIG } from '../components/StatusSelect';
import { useToast } from '../components/ui/Toast';

// Types
interface Venture {
    id: string;
    name: string;
    description: string;
    founder_name?: string; // Top level field
    // New Fields
    city: string;
    location?: string; // Added location
    revenue_12m?: string;
    full_time_employees?: string;
    growth_focus: string;
    revenue_potential_3y: string;
    min_investment?: string; // Optional as it comes from commitment
    incremental_hiring?: string; // Optional as it comes from commitment
    // JSONB Fields
    growth_current: any; // { industry, product, segment, geography }
    growth_target: any; // { product, segment, geography } (descriptions)
    commitment?: any; // Added commitment object
    needs: { id?: string; stream: string; status: string }[]; // mapped from streams
    target_jobs?: number;
    financial_condition?: string;
    time_commitment?: string;
    second_line_team?: string;
    revenue_potential_12m?: string;
    status: string;
    program_recommendation?: string;
    agreement_status?: string; // 'Sent', 'Signed', etc.
    venture_partner?: string; // New for Phase 15
    created_at: string;
    // VSM Fields
    vsm_notes?: string;
    internal_comments?: string;
    ai_analysis?: any;
    vsm_reviewed_at?: string; // Timestamp when VSM reviewed
    assigned_panelist_id?: string;
}

function getVentureDisplayStatus(venture: Venture): { label: string; color: string; bg: string } {
    const status = venture.status;
    const rec = venture.program_recommendation;

    if (status === 'Panel Review' && rec?.includes('Prime')) {
        return { label: 'Pending with Panel (Prime)', color: 'text-purple-700', bg: 'bg-purple-50' };
    }
    if (status === 'Panel Review') {
        return { label: 'Pending with Panel (Core/Select)', color: 'text-indigo-700', bg: 'bg-indigo-50' };
    }
    if (status === 'Approved') {
        return { label: 'Accepted by Business', color: 'text-green-700', bg: 'bg-green-50' };
    }
    if (status === 'Rejected') {
        return { label: 'Declined by Business', color: 'text-red-700', bg: 'bg-red-50' };
    }
    if (status === 'Under Review') {
        return { label: 'Under Review', color: 'text-blue-700', bg: 'bg-blue-50' };
    }
    if (status === 'Submitted') {
        return { label: 'Pending with Screening Manager', color: 'text-amber-700', bg: 'bg-amber-50' };
    }
    if (status === 'Draft') {
        return { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-50' };
    }
    return { label: status, color: 'text-gray-700', bg: 'bg-gray-50' };
}

const OtherDetailsSection: React.FC<{ selectedVenture: any; vsmNotes: string; setVsmNotes: (v: string) => void }> = ({ selectedVenture, vsmNotes, setVsmNotes }) => {
    const [open, setOpen] = useState(true);
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
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

                    {/* VSM Notes */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                            Screening Manager Notes (optional)
                        </label>
                        <textarea
                            className="w-full h-36 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none resize-none transition"
                            placeholder="Add your notes from the call or assessment here..."
                            value={vsmNotes}
                            onChange={e => setVsmNotes(e.target.value)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

const RATING_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
    Green: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    Yellow: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    Red: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

const RatingBadge: React.FC<{ rating: string }> = ({ rating }) => {
    const style = RATING_STYLES[rating] || RATING_STYLES.Yellow;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${style.bg} ${style.text}`}>
            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
            {rating}
        </span>
    );
};

const LegacyInsights: React.FC<{ analysisResult: any }> = ({ analysisResult }) => (
    <div className="space-y-0 divide-y divide-gray-100">
        <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Existing Venture Profile</span>
            </div>
            <div className="space-y-3">
                <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase">Profile Summary</span>
                    <p className="text-sm text-gray-700 mt-1">{analysisResult.existing_venture_profile?.profile_summary || 'Not available'}</p>
                </div>
                <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase">Product & Growth History</span>
                    <p className="text-sm text-gray-700 mt-1">{analysisResult.existing_venture_profile?.current_product_growth_history || 'Not available'}</p>
                </div>
            </div>
        </div>
        <div className="p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Venture Definition Clarity</span>
                </div>
                {analysisResult.new_venture_clarity?.definition_clarity_flag && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        analysisResult.new_venture_clarity.definition_clarity_flag === 'Well Defined' ? 'bg-green-100 text-green-700' :
                        analysisResult.new_venture_clarity.definition_clarity_flag === 'Partially Defined' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                    }`}>
                        {analysisResult.new_venture_clarity.definition_clarity_flag}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase">New Product/Service</span>
                    <p className="text-sm text-gray-700 mt-1">{analysisResult.new_venture_clarity?.new_product_or_service || 'Not assessed'}</p>
                </div>
                <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase">New Segment/Market</span>
                    <p className="text-sm text-gray-700 mt-1">{analysisResult.new_venture_clarity?.new_segment_or_market || 'Not assessed'}</p>
                </div>
                <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase">New Geography</span>
                    <p className="text-sm text-gray-700 mt-1">{analysisResult.new_venture_clarity?.new_geography || 'Not assessed'}</p>
                </div>
            </div>
            <div className="mb-4">
                <span className="text-xs font-semibold text-gray-400 uppercase">Clarity Summary</span>
                <p className="text-sm text-gray-700 mt-1">{analysisResult.new_venture_clarity?.clarity_summary || 'Not available'}</p>
            </div>
        </div>
    </div>
);

const ScorecardTable: React.FC<{ scorecard: any[] }> = ({ scorecard }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-gray-200">
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Dimension</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Assessment</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="text-left px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Brief</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {scorecard.map((item: any, i: number) => {
                    const style = RATING_STYLES[item.rating] || RATING_STYLES.Yellow;
                    return (
                        <tr key={i} className={`${style.bg} hover:opacity-90 transition-opacity`}>
                            <td className="px-6 py-4 font-semibold text-gray-800 whitespace-nowrap">{item.dimension}</td>
                            <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{item.assessment}</td>
                            <td className="px-4 py-4 text-center"><RatingBadge rating={item.rating} /></td>
                            <td className="px-6 py-4 text-gray-700">{item.brief}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

const AIInsightsSection: React.FC<{ selectedVenture: any; vsmNotes: string; analyzing: boolean; analysisResult: any; onRunAnalysis: () => void }> = ({ analyzing, analysisResult, onRunAnalysis }) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <span className="text-base font-bold text-gray-700">SCALE Scorecard</span>
                {analysisResult && !analyzing && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-600">
                        <Sparkles className="w-3 h-3" />
                        AI Generated
                    </span>
                )}
            </div>
            <button
                onClick={onRunAnalysis}
                disabled={analyzing || !!analysisResult}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors shadow-sm"
            >
                {analyzing ? (<><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>) : analysisResult ? (<><Sparkles className="w-4 h-4" /> Insights Generated</>) : (<><Sparkles className="w-4 h-4" /> Generate insights</>)}
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
                <p className="text-sm font-medium">Analysing venture data…</p>
            </div>
        )}
        {analysisResult && !analyzing && (
            analysisResult.scorecard
                ? <ScorecardTable scorecard={analysisResult.scorecard} />
                : <LegacyInsights analysisResult={analysisResult} />
        )}
    </div>
);

const RecommendProgramSection: React.FC<{
    program: string;
    setProgram: (v: string) => void;
    internalComments: string;
    setInternalComments: (v: string) => void;
    userRole: string | null;
    selectedPartner: string;
    setSelectedPartner: (v: string) => void;
    panelists: any[];
    selectedPanelist: string;
    setSelectedPanelist: (v: string) => void;
    saving: boolean;
    onSave: () => void;
    isAlreadySubmitted: boolean;
    reviewedAt?: string;
    venture?: Venture;
}> = ({ program, setProgram, internalComments, setInternalComments, userRole, selectedPartner, setSelectedPartner, panelists, selectedPanelist, setSelectedPanelist, saving, onSave, isAlreadySubmitted, reviewedAt, venture }) => {
    const [editing, setEditing] = useState(!isAlreadySubmitted);
    const locked = isAlreadySubmitted && !editing;

    return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-gray-400" />
                <span className="text-base font-bold text-gray-700">Recommend program</span>
            </div>
            {isAlreadySubmitted && reviewedAt && (
                <span className="text-xs text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200">
                    ✓ Reviewed {new Date(reviewedAt).toLocaleDateString()}
                </span>
            )}
        </div>
        <div className="p-6 space-y-5">
            {isAlreadySubmitted && (
                <div className={`${locked ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4 flex items-start gap-3`}>
                    <div className={`w-5 h-5 rounded-full ${locked ? 'bg-green-500' : 'bg-blue-500'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className={`text-sm font-semibold ${locked ? 'text-green-900' : 'text-blue-900'}`}>Already Reviewed</p>
                        <p className={`text-xs ${locked ? 'text-green-700' : 'text-blue-700'} mt-1`}>
                            {locked ? 'Click "Edit Recommendation" below to make changes.' : 'You are now editing. Make changes and click "Update Recommendation" to save.'}
                        </p>
                    </div>
                </div>
            )}
            {venture && isAlreadySubmitted && (
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Status:</span>
                    {(() => {
                        const ds = getVentureDisplayStatus(venture);
                        return (
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${ds.bg} ${ds.color}`}>
                                {ds.label}
                            </span>
                        );
                    })()}
                    {venture.assigned_panelist_id && (() => {
                        const assignedP = panelists.find(p => p.id === venture.assigned_panelist_id);
                        return assignedP ? (
                            <>
                                <span className="text-xs text-gray-400">|</span>
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned To:</span>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                                    {assignedP.name}
                                </span>
                            </>
                        ) : null;
                    })()}
                    {venture.status === 'Panel Review' && venture.program_recommendation && venture.program_recommendation !== 'Not Recommended' && venture.program_recommendation !== 'Selfserve' && (
                        <>
                            <span className="text-xs text-gray-400">|</span>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                Email Sent
                            </span>
                        </>
                    )}
                </div>
            )}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select a program</label>
                <select
                    className={`w-full p-3 border border-gray-200 rounded-lg outline-none text-sm ${locked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-300'}`}
                    value={program}
                    onChange={e => setProgram(e.target.value)}
                    disabled={locked}
                >
                    <option value="">Select a program…</option>
                    <option value="Selfserve">Self-Serve</option>
                    <option value="Accelerate Core/Select">Accelerate Core/Select</option>
                    <option value="Accelerate Prime">Accelerate Prime</option>
                </select>
            </div>
            {panelists.length > 0 && (
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Panelist</label>
                    <select
                        className={`w-full p-3 border border-gray-200 rounded-lg outline-none text-sm ${locked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-800 focus:ring-2 focus:ring-green-100 focus:border-green-300'}`}
                        value={selectedPanelist}
                        onChange={e => setSelectedPanelist(e.target.value)}
                        disabled={locked}
                    >
                        <option value="">Select a panelist…</option>
                        {panelists.map((panelist) => (
                            <option key={panelist.id} value={panelist.id}>
                                {panelist.name} ({panelist.email})
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">
                        The application will be sent to this panelist for review
                    </p>
                </div>
            )}
            {userRole === 'committee' && (
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Assign Venture Partner</label>
                    <select
                        className={`w-full p-3 border border-gray-200 rounded-lg outline-none text-sm ${locked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-800 focus:ring-2 focus:ring-purple-100 focus:border-purple-300'}`}
                        value={selectedPartner}
                        onChange={e => setSelectedPartner(e.target.value)}
                        disabled={locked}
                    >
                        <option value="">Select Partner…</option>
                        <option value="Arun Kumar">Arun Kumar</option>
                        <option value="Meetul Patel">Meetul Patel</option>
                        <option value="Rajesh Jain">Rajesh Jain</option>
                    </select>
                </div>
            )}
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Comments</label>
                <textarea
                    className={`w-full h-24 p-3 border border-gray-200 rounded-lg outline-none text-sm placeholder:text-gray-400 resize-none ${locked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 text-gray-700 focus:ring-2 focus:ring-blue-100 focus:border-blue-300'}`}
                    placeholder="Add any internal notes or comments…"
                    value={internalComments}
                    onChange={e => setInternalComments(e.target.value)}
                    disabled={locked}
                />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                {locked ? (
                    <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-2 px-8 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
                    >
                        <Pencil className="w-4 h-4" />
                        Edit Recommendation
                    </button>
                ) : (
                    <>
                        {isAlreadySubmitted && (
                            <button
                                onClick={() => setEditing(false)}
                                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                        <button onClick={onSave} disabled={saving || !program} className="flex items-center gap-2 px-8 py-3 rounded-lg bg-gray-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-md">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isAlreadySubmitted ? 'Update Recommendation' : 'Submit'}
                        </button>
                    </>
                )}
            </div>
        </div>
    </div>
    );
};

export const VSMDashboard: React.FC = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [ventures, setVentures] = useState<Venture[]>([]);
    const [selectedVenture, setSelectedVenture] = useState<Venture | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any | null>(null);

    // Form State
    const [vsmNotes, setVsmNotes] = useState('');
    const [program, setProgram] = useState('');
    const [internalComments, setInternalComments] = useState('');
    const [saving, setSaving] = useState(false);

    // Filter & Sort State
    const [revenueFilter, setRevenueFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    // Venture Partner State
    const [selectedPartner, setSelectedPartner] = useState('');

    // Panelist State
    const [panelists, setPanelists] = useState<any[]>([]);
    const [selectedPanelist, setSelectedPanelist] = useState('');

    // Edit Profile State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editProfileData, setEditProfileData] = useState<any>({});

    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            checkUserRole();
        }
    }, [user]);

    useEffect(() => {
        if (userRole) {
            fetchVentures();
        }
    }, [userRole, sortOrder]);

    // Fetch panelists when program changes
    useEffect(() => {
        const fetchPanelists = async () => {
            if (!program) {
                setPanelists([]);
                setSelectedPanelist('');
                return;
            }

            // Map program names to panelist program types
            let programTypes: string[] = [];
            if (program === 'Accelerate Prime') programTypes = ['Prime'];
            else if (program === 'Accelerate Core/Select') programTypes = ['Core', 'Select'];
            else {
                setPanelists([]);
                setSelectedPanelist('');
                return;
            }

            try {
                const results = await Promise.all(programTypes.map(pt => api.getPanelistsByProgram(pt)));
                setPanelists(results.flat());
            } catch (error) {
                console.error('Error fetching panelists:', error);
                setPanelists([]);
            }
        };

        fetchPanelists();
    }, [program]);

    const checkUserRole = () => {
        if (!user) {
            setUserRole('not-logged-in');
            return;
        }

        const email = user.email || '';
        // Check for Panel (Prime) first (arun@admin.com)
        if (email.includes('arun')) {
            setUserRole('venture_mgr');
            return;
        }
        // Check for Committee (committee@admin.com)
        if (email.includes('committee')) {
            setUserRole('committee');
            return;
        }
        // Then Screening Manager (other admin emails)
        if (email.includes('admin')) {
            setUserRole('success_mgr');
            return;
        }

        // Fallback or explicit profile check
        setUserRole('entrepreneur');
    };

    const fetchVentures = async () => {
        setLoading(true);
        try {
            const { ventures: data } = await api.getVentures({ sortBy: 'created_at', sortOrder });

            let filteredData = data || [];

            // ROLE BASED FILTERING (keep client-side for now as API returns all for staff)
            if (userRole === 'venture_mgr') {
                filteredData = filteredData.filter((v: any) => v.program_recommendation === 'Accelerate Prime');
            } else if (userRole === 'committee') {
                filteredData = filteredData.filter((v: any) => ['Accelerate Core', 'Accelerate Select', 'Accelerate Core/Select'].includes(v.program_recommendation || ''));
            }

            // Map data to ensure needs array exists and streams are mapped to needs
            const mappedVentures = filteredData.map((v: any) => ({
                ...v,
                needs: (v.streams || v.needs || []).map((s: any) => ({
                    id: s.id,
                    stream: s.stream_name,
                    status: s.status
                }))
            }));

            setVentures(mappedVentures);
        } catch (error) {
            console.error('Error fetching ventures:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVentureSelect = async (venture: Venture) => {
        // Optimistically set selected to show UI immediately
        setSelectedVenture(venture);
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

            // Setup form state
            setVsmNotes(freshVenture.vsm_notes || '');
            setProgram(freshVenture.program_recommendation || 'Selfserve');
            setSelectedPanelist(freshVenture.assigned_panelist_id || '');
            setInternalComments(freshVenture.internal_comments || '');
            setAnalysisResult(freshVenture.ai_analysis || null);
            setSelectedPartner(freshVenture.venture_partner || '');
            setEditProfileData({
                product: freshVenture.focus_product || '',
                segment: freshVenture.focus_segment || '',
                geography: freshVenture.focus_geography || '',
            });

        } catch (error) {
            console.error('Error fetching venture details:', error);
        }
    };

    const handleSave = async () => {
        if (!selectedVenture) return;

        // VALIDATION
        if (!program) {
            toast('Please select a Recommended Program before submitting.', 'warning');
            return;
        }

        setSaving(true);
        try {
            const updatePayload: any = {
                vsm_notes: vsmNotes,
                program_recommendation: program,
                internal_comments: internalComments,
                status: 'Panel Review', // Recommending to panel moves status to Panel Review
                ai_analysis: analysisResult || selectedVenture.ai_analysis, // Persist AI analysis if generated
                vsm_reviewed_at: new Date().toISOString() // Track when VSM reviewed
            };

            if (selectedPanelist) {
                updatePayload.assigned_panelist_id = selectedPanelist;
            }

            if (userRole === 'committee') {
                updatePayload.venture_partner = selectedPartner;
            }

            // Save to database
            await api.updateVenture(selectedVenture.id, updatePayload);

            // Update local state to reflect changes immediately
            setVentures(prev => prev.map(v =>
                v.id === selectedVenture.id
                    ? { ...v, ...updatePayload }
                    : v
            ));

            // Update the selected venture state as well
            setSelectedVenture(prev => prev ? { ...prev, ...updatePayload } : null);

            // Success feedback
            toast('Recommendation submitted. Status: Pending with Panel — ' + program, 'success');

            // Navigate back to list after 1 second
            setTimeout(() => {
                setSelectedVenture(null);
                // Refresh ventures list to ensure latest data from DB
                fetchVentures();
            }, 1000);

        } catch (error: any) {
            console.error('Error saving:', error);
            toast('Failed to save assessment: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const runAIAnalysis = async () => {
        if (!selectedVenture) return;
        setAnalyzing(true);

        try {
            const result = await api.generateInsights(selectedVenture.id, vsmNotes);
            const insights = result.insights || result;

            setAnalysisResult(insights);
            setVentures(prev => prev.map(v =>
                v.id === selectedVenture.id ? { ...v, ai_analysis: insights } : v
            ));
        } catch (error: any) {
            console.error('Error generating AI insights:', error);
            toast(error.message || 'Failed to generate AI insights.', 'error');
        } finally {
            setAnalyzing(false);
        }
    };

    const saveProfileChanges = async () => {
        if (!selectedVenture) return;

        try {
            await api.updateVenture(selectedVenture.id, { growth_target: editProfileData });

            setVentures(prev => prev.map(v =>
                v.id === selectedVenture.id ? { ...v, growth_target: editProfileData } : v
            ));

            setSelectedVenture(prev => prev ? { ...prev, growth_target: editProfileData } : null);
            setIsEditingProfile(false);
            toast('Venture profile updated.', 'success');

        } catch (e) {
            console.error("Error updating profile", e);
            toast('Failed to update profile.', 'error');
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">


            {/* MASTER VIEW: Venture List (Cards) */}
            {!selectedVenture ? (
                <div className="space-y-4">
                    {/* Column Headers - always visible */}
                    <div className="grid grid-cols-12 gap-4 px-8 pb-4 border-b border-gray-200 items-end">
                        <div className="col-span-5">
                            <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Venture</span>
                        </div>
                        <div className="col-span-2 text-center">
                            <button
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors inline-flex items-center gap-1"
                            >
                                Submitted
                                <span className="text-xs">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                            </button>
                        </div>
                        <div className="col-span-3 text-center">
                            <span className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide">Program</span>
                        </div>
                        <div className="col-span-2 text-right">
                            <select
                                value={revenueFilter}
                                onChange={(e) => setRevenueFilter(e.target.value)}
                                className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
                            >
                                <option value="all">Revenue</option>
                                <option value="0-5">Below 5 Cr</option>
                                <option value="5-25">5 - 25 Cr</option>
                                <option value="25-75">25 - 75 Cr</option>
                                <option value="75+">Above 75 Cr</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-16 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <span className="text-sm text-gray-400">Loading applications...</span>
                        </div>
                    ) : ventures.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <p className="text-lg font-medium">No ventures assigned</p>
                            <p className="text-sm mt-1">Ventures will appear here once assigned to you.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                                {ventures
                                    .filter(v => {
                                        if (revenueFilter === 'all') return true;
                                        const revenue = v.revenue_12m || v.commitment?.lastYearRevenue || '';
                                        const num = parseFloat(String(revenue));
                                        if (!isNaN(num)) {
                                            const [lo, hi] = revenueFilter === '75+' ? [75, Infinity] : revenueFilter.split('-').map(Number);
                                            return num >= lo && num < (hi === Infinity ? Infinity : hi === 75 ? 76 : hi);
                                        }
                                        // Legacy text ranges
                                        const legacyMap: Record<string, string[]> = { '0-5': ['1Cr-5Cr'], '5-25': ['5Cr-25Cr'], '25-75': ['25Cr-75Cr'], '75+': ['>75Cr'] };
                                        return (legacyMap[revenueFilter] || []).includes(String(revenue));
                                    }).length === 0 && revenueFilter !== 'all' && (
                                    <div className="text-center py-16 text-gray-400">
                                        <p className="text-lg font-medium">No ventures match this filter</p>
                                        <p className="text-sm mt-1">Try selecting a different revenue range.</p>
                                    </div>
                                )}
                                {ventures
                                    .filter(v => {
                                        if (revenueFilter === 'all') return true;
                                        const revenue = v.revenue_12m || v.commitment?.lastYearRevenue || '';
                                        const num = parseFloat(String(revenue));
                                        if (!isNaN(num)) {
                                            const [lo, hi] = revenueFilter === '75+' ? [75, Infinity] : revenueFilter.split('-').map(Number);
                                            return num >= lo && num < (hi === Infinity ? Infinity : hi === 75 ? 76 : hi);
                                        }
                                        // Legacy text ranges
                                        const legacyMap: Record<string, string[]> = { '0-5': ['1Cr-5Cr'], '5-25': ['5Cr-25Cr'], '25-75': ['25Cr-75Cr'], '75+': ['>75Cr'] };
                                        return (legacyMap[revenueFilter] || []).includes(String(revenue));
                                    })
                                    .map(v => (
                                    <div
                                        key={v.id}
                                        onClick={() => handleVentureSelect(v)}
                                        className="bg-white rounded-2xl border border-gray-200 hover:border-blue-400 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer px-8 py-6 grid grid-cols-12 gap-4 items-center group"
                                    >
                                        {/* Venture Info */}
                                        <div className="col-span-5 space-y-1.5">
                                            <h2 className="text-[17px] font-semibold text-gray-900 leading-snug group-hover:text-blue-600 transition-colors">
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

                                        {/* Program */}
                                        <div className="col-span-3 text-center border-l border-gray-100 pl-4">
                                            <span className={`inline-block px-4 py-1.5 rounded-full text-[13px] font-semibold ${v.program_recommendation
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                {v.program_recommendation || 'Awaiting review'}
                                            </span>
                                        </div>

                                        {/* Revenue & Arrow */}
                                        <div className="col-span-2 flex items-center justify-end gap-3 border-l border-gray-100 pl-4">
                                            <div className="text-right">
                                                <div className="text-[15px] font-semibold text-gray-800 whitespace-nowrap">
                                                    {v.revenue_12m ? (isNaN(Number(v.revenue_12m)) ? v.revenue_12m : `₹${v.revenue_12m} Cr`) : '--'}
                                                </div>
                                            </div>
                                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-gray-300 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200 flex-shrink-0">
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                    )}
                </div>
            ) : (
                /* DETAIL VIEW: Full Screen Venture Assessment */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">

                    {/* Back Button */}
                    <div className="border-b border-gray-100 px-6 py-3 bg-gray-50">
                        <Button variant="ghost" onClick={() => setSelectedVenture(null)} className="text-gray-500 hover:text-gray-900 w-auto px-3 py-2 h-auto text-sm">
                            ← Back to Ventures
                        </Button>
                    </div>

                    {/* Header: Company Name Left, Status Right */}
                    <div className="border-b border-gray-100 px-6 py-5 bg-white flex items-center justify-between sticky top-0 z-20">
                        <h2 className="text-2xl font-bold text-gray-900">{selectedVenture.name}</h2>
                        {(() => {
                            const ds = getVentureDisplayStatus(selectedVenture);
                            return (
                                <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${ds.bg} ${ds.color}`}>
                                    {ds.label}
                                </span>
                            );
                        })()}
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Section 1: Dashboard Metrics */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Revenue</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    {selectedVenture.revenue_12m ? (isNaN(Number(selectedVenture.revenue_12m)) ? selectedVenture.revenue_12m : `₹${selectedVenture.revenue_12m} Cr`) : 'N/A'}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Incremental Revenue (3Y)</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    {(() => { const val = selectedVenture.revenue_potential_3y || selectedVenture.commitment?.revenuePotential; return val ? (isNaN(Number(val)) ? val : `₹${val} Cr`) : 'N/A'; })()}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Current Full Time Employees</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    {selectedVenture.full_time_employees || 'N/A'}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Target Jobs</span>
                                <div className="text-xl font-bold text-gray-900 flex items-center gap-1">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    {selectedVenture.target_jobs || 'N/A'}
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Financial Condition</span>
                                <div className="text-sm font-semibold text-gray-900">
                                    {selectedVenture.financial_condition || 'N/A'}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Owner Involvement</span>
                                <div className="text-sm font-semibold text-gray-900">
                                    {selectedVenture.time_commitment || 'N/A'}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">Leadership Team</span>
                                <div className="text-sm font-semibold text-gray-900">
                                    {selectedVenture.second_line_team || 'N/A'}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Venture Context Comparison (Side-by-Side) */}
                        <div>
                            <div className="flex justify-end items-center mb-4">
                                {(userRole === 'venture_mgr' || userRole === 'committee') && (
                                    <Button
                                        variant="outline"
                                        onClick={() => isEditingProfile ? saveProfileChanges() : setIsEditingProfile(true)}
                                        className="text-xs h-8"
                                    >
                                        {isEditingProfile ? <><Save className="w-3 h-3 mr-1" /> Save Changes</> : <><Edit3 className="w-3 h-3 mr-1" /> Edit Profile</>}
                                    </Button>
                                )}
                            </div>

                            {/* Header Info Row */}
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


                            {/* Comparison Card */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Header Row */}
                                <div className="grid grid-cols-2 divide-x divide-gray-100">
                                    <div className="p-6 pb-3">
                                        <div className="flex items-center gap-2 text-gray-900 font-bold border-b border-gray-100 pb-3">
                                            <Briefcase className="w-4 h-4 text-gray-400" />
                                            Current Business
                                        </div>
                                    </div>
                                    <div className={`p-6 pb-3 ${isEditingProfile ? 'bg-blue-50/30' : 'bg-white'}`}>
                                        <div className="flex items-center gap-2 text-blue-900 font-bold border-b border-blue-100 pb-3">
                                            <TrendingUp className="w-4 h-4 text-blue-600" />
                                            New Venture
                                        </div>
                                    </div>
                                </div>

                                {/* Row 1: Product */}
                                <div className="grid grid-cols-2 divide-x divide-gray-100">
                                    <div className="px-6 py-3">
                                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Product / Service</span>
                                        <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[44px] flex items-center">{(selectedVenture as any).what_do_you_sell || 'N/A'}</p>
                                    </div>
                                    <div className={`px-6 py-3 ${isEditingProfile ? 'bg-blue-50/30' : 'bg-white'}`}>
                                        <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Product</span>
                                        {isEditingProfile ? (
                                            <input
                                                className="w-full p-2.5 text-sm border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                                                value={editProfileData.product || ''}
                                                onChange={e => setEditProfileData({ ...editProfileData, product: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[44px] flex items-center shadow-sm shadow-blue-100/50">{(selectedVenture as any).focus_product || 'N/A'}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2: Segment */}
                                <div className="grid grid-cols-2 divide-x divide-gray-100">
                                    <div className="px-6 py-3">
                                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Customer Segment</span>
                                        <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[44px] flex items-center">{(selectedVenture as any).who_do_you_sell_to || 'N/A'}</p>
                                    </div>
                                    <div className={`px-6 py-3 ${isEditingProfile ? 'bg-blue-50/30' : 'bg-white'}`}>
                                        <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Segment</span>
                                        {isEditingProfile ? (
                                            <input
                                                className="w-full p-2.5 text-sm border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                                                value={editProfileData.segment || ''}
                                                onChange={e => setEditProfileData({ ...editProfileData, segment: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[44px] flex items-center shadow-sm shadow-blue-100/50">{(selectedVenture as any).focus_segment || 'N/A'}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Row 3: Region */}
                                <div className="grid grid-cols-2 divide-x divide-gray-100">
                                    <div className="px-6 py-3 pb-6">
                                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Region</span>
                                        <p className="text-sm text-gray-800 bg-gray-50/50 p-3 rounded-lg border border-gray-100 min-h-[44px] flex items-center">{(selectedVenture as any).which_regions || 'N/A'}</p>
                                    </div>
                                    <div className={`px-6 py-3 pb-6 ${isEditingProfile ? 'bg-blue-50/30' : 'bg-white'}`}>
                                        <span className="text-xs font-bold text-blue-400 uppercase block mb-1.5">New Region</span>
                                        {isEditingProfile ? (
                                            <input
                                                className="w-full p-2.5 text-sm border border-blue-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-300 outline-none"
                                                value={editProfileData.geography || ''}
                                                onChange={e => setEditProfileData({ ...editProfileData, geography: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-blue-50 min-h-[44px] flex items-center shadow-sm shadow-blue-100/50">{(selectedVenture as any).focus_geography || 'N/A'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Growth Idea Support Status */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                Growth Idea Support Status
                            </h2>
                            <div className="grid grid-cols-3 gap-4">
                                {/* Row 1 */}
                                {['Product', 'Go-To-Market (GTM)', 'Capital Planning'].map(stream => {
                                    const rawStatus = (selectedVenture.needs || []).find((n: any) =>
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
                                {/* Row 2 */}
                                {['Supply Chain', 'Operations', 'Team'].map(stream => {
                                    const rawStatus = (selectedVenture.needs || []).find((n: any) =>
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

                        {/* Section 4: Company Document */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">
                                Company Document
                            </h2>
                            <div className="bg-white border border-gray-200 rounded-xl p-6">
                                <p className="text-sm text-gray-600 mb-4">
                                    Corporate presentation uploaded by the venture (screening manager can download)
                                </p>
                                {(selectedVenture as any).corporate_presentation_url ? (
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                            <span className="text-sm font-medium text-gray-900">
                                                {(selectedVenture as any).corporate_presentation_url.split('/').pop()?.replace(/^\d+_/, '') || 'Corporate Presentation'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const url = await api.getVentureDocumentUrl((selectedVenture as any).corporate_presentation_url);
                                                    window.open(url, '_blank');
                                                } catch (err) {
                                                    console.error('Failed to get document URL:', err);
                                                    toast('Failed to download document. Please try again.', 'error');
                                                }
                                            }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-semibold"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Download
                                        </button>
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

                        {/* Section 5: Other Details (Optional, Collapsible) */}
                        <OtherDetailsSection selectedVenture={selectedVenture} vsmNotes={vsmNotes} setVsmNotes={setVsmNotes} />

                        {/* Section 6: Generate AI Insights CTA + Output */}
                        <AIInsightsSection
                            selectedVenture={selectedVenture}
                            vsmNotes={vsmNotes}
                            analyzing={analyzing}
                            analysisResult={analysisResult}
                            onRunAnalysis={runAIAnalysis}
                        />

                        {/* Section 7: Recommend Program */}
                        <RecommendProgramSection
                            program={program}
                            setProgram={setProgram}
                            internalComments={internalComments}
                            setInternalComments={setInternalComments}
                            userRole={userRole}
                            selectedPartner={selectedPartner}
                            setSelectedPartner={setSelectedPartner}
                            panelists={panelists}
                            selectedPanelist={selectedPanelist}
                            setSelectedPanelist={setSelectedPanelist}
                            saving={saving}
                            onSave={handleSave}
                            isAlreadySubmitted={!!selectedVenture?.program_recommendation}
                            reviewedAt={(selectedVenture as any)?.vsm_reviewed_at}
                            venture={selectedVenture || undefined}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
