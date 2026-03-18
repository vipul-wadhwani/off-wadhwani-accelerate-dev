import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { StarRating } from '../components/ui/StarRating';
import type { StreamStatus, ExpansionType, FinalRecommendation, ProgramCategory } from '../types/panelFeedback';
import { useToast } from '../components/ui/Toast';

const STREAM_STATUS_OPTIONS: { value: StreamStatus; label: string }[] = [
    { value: 'not_started', label: 'Not Started' },
    { value: 'on_track', label: 'On Track' },
    { value: 'need_some_advice', label: 'Need Some Advice' },
    { value: 'need_deep_support', label: 'Need Deep Support' },
    { value: 'completed', label: 'Completed' },
];

const GROWTH_VENTURE_TYPES = [
    'Expand to New Markets - Domestic',
    'Expand to New Markets - Exports',
    'Enable a new Sales channel',
    'Introduce a new Product',
];

const PRIME_RATING_OPTIONS: { field: string; label: string; descriptions: string[] }[] = [
    {
        field: 'ratingBusinessModelClarity',
        label: 'Business Model & Growth Idea Clarity: What is your business today (revenue streams, key customers/geographies), and what is the single expansion idea you\'re proposing? Why this idea now?',
        descriptions: [
            'REJECT: Cannot articulate current business, no specific growth idea',
            'Vague revenue description, highly concentrated, expansion idea is broad/wishful',
            'Revenue model exists but complex/unclear, single customer/geography heavy, expansion idea somewhat defined',
            'Defined revenue model (1-2 streams), moderate diversification, clear expansion idea, reasonable timing logic',
            'Clear revenue model (2-3 streams), diversified customers/geographies, specific expansion idea matching 1 of 7 growth areas, compelling "why now" logic',
        ],
    },
    {
        field: 'ratingHistoricalGrowth',
        label: 'Historical Growth Trajectory: Over the last 3 years, what has been your revenue growth pattern, key drivers, and any slowdowns?',
        descriptions: [
            'REJECT: Cannot provide 3-year numbers, no growth pattern',
            'Flat/declining revenue, vague drivers, blames external factors',
            'Mixed growth (10-20% avg), some flat years, basic explanations',
            'Steady 20-30% YoY growth OR volatile but upward trajectory with explanations',
            'Consistent 30%+ YoY growth, identifiable drivers, learned from any slowdowns',
        ],
    },
    {
        field: 'ratingFinancialReadiness',
        label: 'Financial Readiness: Last 3 years revenue/profitability trends? Can this expansion be funded internally, or is the business bankable?',
        descriptions: [
            'REJECT: Cannot explain financials, cashflow crisis, no funding clarity',
            'Consistent losses, heavy debt with repayment issues, unclear funding path',
            'Variable profitability, some debt but good repayment history, funding plan exists',
            'Break-even or modest losses with path to profitability, bankable track record, realistic funding plan',
            'Stable/growing profitability, positive cashflow OR strong EBITDA (>15%), clear internal funding path',
        ],
    },
    {
        field: 'ratingTeamLeadership',
        label: 'Team & Leadership Depth: Who runs the business day-to-day apart from you? What critical roles are needed for expansion?',
        descriptions: [
            'REJECT: No team structure, promoter does everything',
            'Founder does everything critical, no functional specialization',
            'Founder leads most functions but some delegation exists, basic hiring plan',
            '2+ key functions led by experienced non-founders, identified expansion hires',
            'Multiple functional heads (sales/ops/finance), clear succession depth, hired senior talent before',
        ],
    },
    {
        field: 'ratingExecutionSeriousness',
        label: 'Execution Seriousness: What specific actions/resources have you already committed to this expansion idea?',
        descriptions: [
            'REJECT: No awareness of expansion steps needed',
            'Just thinking about it, no tangible actions',
            'Discussed internally, minimal resources allocated, early research done',
            'Dedicated 1-3 months, small budget committed, market validation started',
            'Spent 3-6+ months, allocated budget/staff, customer pilots underway',
        ],
    },
];

export const PanelFeedbackForm: React.FC = () => {
    const { ventureId } = useParams<{ ventureId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();

    const [isPrime, setIsPrime] = useState(false);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [, setSubmitted] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const [ventureName, setVentureName] = useState('');
    const [smeName, setSmeName] = useState('');

    // Header fields are computed at submit time from user context

    // === Core/Select fields (Sections A-D) ===
    // Section A
    const [businessOverview, setBusinessOverview] = useState('');
    const [annualRevenueActuals, setAnnualRevenueActuals] = useState('');
    const [projectedAnnualRevenue, setProjectedAnnualRevenue] = useState('');
    const [ratingFinancialHealth, setRatingFinancialHealth] = useState<number | null>(null);
    const [ratingLeadership, setRatingLeadership] = useState<number | null>(null);
    const [insightsFinancialHealth, setInsightsFinancialHealth] = useState('');
    const [insightsLeadership, setInsightsLeadership] = useState('');

    // Section B
    const [growthIdeaTypes, setGrowthIdeaTypes] = useState<string[]>([]);
    const [describeNewProduct, setDescribeNewProduct] = useState('');
    const [describeNewCustomer, setDescribeNewCustomer] = useState('');
    const [describeNewGeography, setDescribeNewGeography] = useState('');
    const [proposedExpansionIdea, setProposedExpansionIdea] = useState('');
    const [selectedExpansionType, setSelectedExpansionType] = useState<ExpansionType | ''>('');
    const [marketEntryRoutes, setMarketEntryRoutes] = useState<string[]>([]);
    const [expansionIdeaDescription, setExpansionIdeaDescription] = useState('');
    const [currentProgress, setCurrentProgress] = useState('');
    const [incrementalRevenue3y, setIncrementalRevenue3y] = useState('');
    const [incrementalJobs3y, setIncrementalJobs3y] = useState('');
    const [ratingClarityExpansion, setRatingClarityExpansion] = useState<number | null>(null);
    const [commentsClarityExpansion, setCommentsClarityExpansion] = useState('');

    // Section C
    const [streamGtm, setStreamGtm] = useState<StreamStatus | ''>('');
    const [streamGtmComments, setStreamGtmComments] = useState('');
    const [streamProductQuality, setStreamProductQuality] = useState<StreamStatus | ''>('');
    const [streamProductQualityComments, setStreamProductQualityComments] = useState('');
    const [streamOperations, setStreamOperations] = useState<StreamStatus | ''>('');
    const [streamOperationsComments, setStreamOperationsComments] = useState('');
    const [streamSupplyChain, setStreamSupplyChain] = useState<StreamStatus | ''>('');
    const [streamSupplyChainComments, setStreamSupplyChainComments] = useState('');
    const [streamOrgDesign, setStreamOrgDesign] = useState<StreamStatus | ''>('');
    const [streamOrgDesignComments, setStreamOrgDesignComments] = useState('');
    const [streamFinance, setStreamFinance] = useState<StreamStatus | ''>('');
    const [streamFinanceComments, setStreamFinanceComments] = useState('');
    const [supportTypeProposal, setSupportTypeProposal] = useState('');
    const [risksRedFlags, setRisksRedFlags] = useState('');

    // Section D
    const [finalRecommendation, setFinalRecommendation] = useState<FinalRecommendation | ''>('');
    const [programCategory, setProgramCategory] = useState<ProgramCategory | ''>('');
    const [additionalNotes, setAdditionalNotes] = useState('');

    // === Prime fields ===
    const [growthVentureType, setGrowthVentureType] = useState('');
    const [growthInitiativeDescription, setGrowthInitiativeDescription] = useState('');
    const [ratingBusinessModelClarity, setRatingBusinessModelClarity] = useState<number | null>(null);
    const [ratingHistoricalGrowth, setRatingHistoricalGrowth] = useState<number | null>(null);
    const [ratingFinancialReadiness, setRatingFinancialReadiness] = useState<number | null>(null);
    const [ratingTeamLeadership, setRatingTeamLeadership] = useState<number | null>(null);
    const [ratingExecutionSeriousness, setRatingExecutionSeriousness] = useState<number | null>(null);
    const [programFitJobCreation, setProgramFitJobCreation] = useState('');
    const [annualRevenueFy2627, setAnnualRevenueFy2627] = useState('');
    const [revenueTarget3yAssumptions, setRevenueTarget3yAssumptions] = useState('');

    const primeRatingSetters: Record<string, React.Dispatch<React.SetStateAction<number | null>>> = {
        ratingBusinessModelClarity: setRatingBusinessModelClarity,
        ratingHistoricalGrowth: setRatingHistoricalGrowth,
        ratingFinancialReadiness: setRatingFinancialReadiness,
        ratingTeamLeadership: setRatingTeamLeadership,
        ratingExecutionSeriousness: setRatingExecutionSeriousness,
    };
    const primeRatingValues: Record<string, number | null> = {
        ratingBusinessModelClarity,
        ratingHistoricalGrowth,
        ratingFinancialReadiness,
        ratingTeamLeadership,
        ratingExecutionSeriousness,
    };

    useEffect(() => {
        if (ventureId) {
            loadVentureData();
        }
    }, [ventureId]);

    const loadVentureData = async () => {
        try {
            const { venture } = await api.getVenture(ventureId!);
            setVentureName(venture.name || '');
            setSmeName(venture.founder_name || '');

            // Determine form variant from venture's program recommendation
            const rec = (venture.program_recommendation || '').toLowerCase();
            setIsPrime(rec.includes('prime'));

            // Check if feedback already submitted for this venture (by anyone)
            const { feedback } = await api.getPanelFeedback(ventureId!);
            const existing = feedback?.[0]; // most recent feedback
            if (existing) {
                populateFromExisting(existing);
                setReadOnly(true);
                setSubmitted(true);
            }
        } catch (err) {
            console.error('Error loading venture:', err);
        } finally {
            setLoading(false);
        }
    };

    const populateFromExisting = (f: any) => {
        // Section A (Core/Select)
        setBusinessOverview(f.business_overview || '');
        setAnnualRevenueActuals(f.annual_revenue_actuals || '');
        setProjectedAnnualRevenue(f.projected_annual_revenue || '');
        setRatingFinancialHealth(f.rating_financial_health ?? null);
        setRatingLeadership(f.rating_leadership ?? null);
        setInsightsFinancialHealth(f.insights_financial_health || '');
        setInsightsLeadership(f.insights_leadership || '');
        // Section B
        setGrowthIdeaTypes(f.growth_idea_types || []);
        setDescribeNewProduct(f.describe_new_product || '');
        setDescribeNewCustomer(f.describe_new_customer || '');
        setDescribeNewGeography(f.describe_new_geography || '');
        setProposedExpansionIdea(f.proposed_expansion_idea || '');
        setSelectedExpansionType(f.selected_expansion_type || '');
        setMarketEntryRoutes(f.market_entry_routes || []);
        setExpansionIdeaDescription(f.expansion_idea_description || '');
        setCurrentProgress(f.current_progress || '');
        setIncrementalRevenue3y(f.incremental_revenue_3y || '');
        setIncrementalJobs3y(f.incremental_jobs_3y || '');
        setRatingClarityExpansion(f.rating_clarity_expansion ?? null);
        setCommentsClarityExpansion(f.comments_clarity_expansion || '');
        // Section C
        setStreamGtm(f.stream_gtm || '');
        setStreamGtmComments(f.stream_gtm_comments || '');
        setStreamProductQuality(f.stream_product_quality || '');
        setStreamProductQualityComments(f.stream_product_quality_comments || '');
        setStreamOperations(f.stream_operations || '');
        setStreamOperationsComments(f.stream_operations_comments || '');
        setStreamSupplyChain(f.stream_supply_chain || '');
        setStreamSupplyChainComments(f.stream_supply_chain_comments || '');
        setStreamOrgDesign(f.stream_org_design || '');
        setStreamOrgDesignComments(f.stream_org_design_comments || '');
        setStreamFinance(f.stream_finance || '');
        setStreamFinanceComments(f.stream_finance_comments || '');
        setSupportTypeProposal(f.support_type_proposal || '');
        setRisksRedFlags(f.risks_red_flags || '');
        // Section D
        setFinalRecommendation(f.final_recommendation || '');
        setProgramCategory(f.program_category || '');
        setAdditionalNotes(f.additional_notes || '');
        // Prime fields
        setGrowthVentureType(f.growth_venture_type || '');
        setGrowthInitiativeDescription(f.growth_initiative_description || '');
        setRatingBusinessModelClarity(f.rating_business_model_clarity ?? null);
        setRatingHistoricalGrowth(f.rating_historical_growth ?? null);
        setRatingFinancialReadiness(f.rating_financial_readiness ?? null);
        setRatingTeamLeadership(f.rating_team_leadership ?? null);
        setRatingExecutionSeriousness(f.rating_execution_seriousness ?? null);
        setProgramFitJobCreation(f.program_fit_job_creation || '');
        setAnnualRevenueFy2627(f.annual_revenue_fy26_27 || '');
        setRevenueTarget3yAssumptions(f.revenue_target_3y_assumptions || '');
        setSmeName(f.sme_name || '');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setSubmitting(true);
        try {
            const commonPayload = {
                panel_expert_name: user?.user_metadata?.full_name || user?.email || 'Unknown',
                panel_date: new Date().toISOString().split('T')[0],
                sme_name: smeName || null,
            };

            let payload: any;

            if (isPrime) {
                payload = {
                    ...commonPayload,
                    growth_venture_type: growthVentureType || null,
                    growth_initiative_description: growthInitiativeDescription || null,
                    rating_business_model_clarity: ratingBusinessModelClarity,
                    rating_historical_growth: ratingHistoricalGrowth,
                    rating_financial_readiness: ratingFinancialReadiness,
                    rating_team_leadership: ratingTeamLeadership,
                    rating_execution_seriousness: ratingExecutionSeriousness,
                    program_fit_job_creation: programFitJobCreation || null,
                    annual_revenue_fy26_27: annualRevenueFy2627 || null,
                    revenue_target_3y_assumptions: revenueTarget3yAssumptions || null,
                    // Section D
                    final_recommendation: finalRecommendation || null,
                    program_category: programCategory || null,
                    additional_notes: additionalNotes || null,
                };
            } else {
                if (!finalRecommendation) {
                    toast('Please select a Final Recommendation in Section D.', 'warning');
                    setSubmitting(false);
                    return;
                }
                payload = {
                    ...commonPayload,
                    // Section A
                    business_overview: businessOverview || null,
                    annual_revenue_actuals: annualRevenueActuals || null,
                    projected_annual_revenue: projectedAnnualRevenue || null,
                    rating_financial_health: ratingFinancialHealth,
                    rating_leadership: ratingLeadership,
                    insights_financial_health: insightsFinancialHealth || null,
                    insights_leadership: insightsLeadership || null,
                    // Section B
                    growth_idea_types: growthIdeaTypes.length > 0 ? growthIdeaTypes : null,
                    describe_new_product: describeNewProduct || null,
                    describe_new_customer: describeNewCustomer || null,
                    describe_new_geography: describeNewGeography || null,
                    proposed_expansion_idea: proposedExpansionIdea || null,
                    selected_expansion_type: selectedExpansionType || null,
                    market_entry_routes: marketEntryRoutes.length > 0 ? marketEntryRoutes : null,
                    expansion_idea_description: expansionIdeaDescription || null,
                    current_progress: currentProgress || null,
                    incremental_revenue_3y: incrementalRevenue3y || null,
                    incremental_jobs_3y: incrementalJobs3y || null,
                    rating_clarity_expansion: ratingClarityExpansion,
                    comments_clarity_expansion: commentsClarityExpansion || null,
                    // Section C
                    stream_gtm: streamGtm || null,
                    stream_gtm_comments: streamGtmComments || null,
                    stream_product_quality: streamProductQuality || null,
                    stream_product_quality_comments: streamProductQualityComments || null,
                    stream_operations: streamOperations || null,
                    stream_operations_comments: streamOperationsComments || null,
                    stream_supply_chain: streamSupplyChain || null,
                    stream_supply_chain_comments: streamSupplyChainComments || null,
                    stream_org_design: streamOrgDesign || null,
                    stream_org_design_comments: streamOrgDesignComments || null,
                    stream_finance: streamFinance || null,
                    stream_finance_comments: streamFinanceComments || null,
                    support_type_proposal: supportTypeProposal || null,
                    risks_red_flags: risksRedFlags || null,
                    // Section D
                    final_recommendation: finalRecommendation || null,
                    program_category: programCategory || null,
                    additional_notes: additionalNotes || null,
                };
            }

            await api.createPanelFeedback(ventureId!, payload);

            // Update venture status based on panel recommendation
            // (trigger auto-logs to venture_status_history)
            if (finalRecommendation === 'proceed') {
                await api.updateVenture(ventureId!, { status: 'Approved' });
            }

            // Send selection welcome email if panel recommends proceeding
            if (finalRecommendation === 'proceed') {
                const category = programCategory || (isPrime ? 'prime' : '');
                if (category) {
                    api.sendSelectionEmail(ventureId!, category)
                        .then(() => console.log('Selection welcome email sent'))
                        .catch((err) => console.error('Failed to send selection email:', err));
                }
            }

            setSubmitted(true);
            setReadOnly(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            console.error('Error submitting feedback:', err);
            toast('Failed to submit feedback: ' + err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const goBack = () => {
        const role = user?.user_metadata?.role;
        if (role === 'venture_mgr') navigate('/vmanager/dashboard');
        else if (role === 'committee_member') navigate('/committee/dashboard');
        else navigate(-1);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
            </div>
        );
    }

    // No early return for submitted — we show the form in read-only mode below

    const inputClass = `w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none ${readOnly ? 'bg-gray-50 text-gray-700 cursor-default' : 'focus:ring-2 focus:ring-red-500 focus:border-red-500'}`;
    const textareaClass = `${inputClass} resize-none`;
    const selectClass = inputClass;

    // ========== PRIME FORM ==========
    const questionNumber = (num: number) => (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold flex-shrink-0">
            {num}
        </span>
    );

    const renderPrimeForm = () => (
        <>
            {/* Q1: Growth Venture Type */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                        {questionNumber(1)}
                        <label className="text-base font-semibold text-gray-900 leading-snug">Growth Venture Type <span className="text-red-500">*</span></label>
                    </div>
                    <div className="ml-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {GROWTH_VENTURE_TYPES.map(type => (
                            <label
                                key={type}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${growthVentureType === type
                                    ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="growthVentureType"
                                    value={type}
                                    checked={growthVentureType === type}
                                    onChange={e => setGrowthVentureType(e.target.value)}
                                    className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                                    required
                                />
                                <span className="text-sm font-medium text-gray-700">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            {/* Q2: Growth Initiative Description */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                        {questionNumber(2)}
                        <label className="text-base font-semibold text-gray-900 leading-snug">Describe the Growth Initiative of the Venture (in 1 line) <span className="text-red-500">*</span></label>
                    </div>
                    <div className="ml-10">
                        <input type="text" value={growthInitiativeDescription} onChange={e => setGrowthInitiativeDescription(e.target.value)} className={inputClass} placeholder="One-line description of the growth initiative..." required />
                    </div>
                </div>
            </div>

            {/* Q3-Q7: Rating Questions */}
            {PRIME_RATING_OPTIONS.map(({ field, label, descriptions }, qIdx) => (
                <div key={field} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-start gap-3 mb-4">
                            {questionNumber(qIdx + 3)}
                            <label className="text-base font-semibold text-gray-900 leading-snug">{label} <span className="text-red-500">*</span></label>
                        </div>
                        <div className="ml-10 space-y-2">
                            {descriptions.map((desc, idx) => {
                                const ratingValue = idx + 1;
                                const isSelected = primeRatingValues[field] === ratingValue;
                                return (
                                    <label
                                        key={ratingValue}
                                        className={`flex items-start gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                            ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name={field}
                                            value={ratingValue}
                                            checked={isSelected}
                                            onChange={() => primeRatingSetters[field](ratingValue)}
                                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 mt-0.5 flex-shrink-0"
                                            required
                                        />
                                        <span className={`text-sm leading-relaxed ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                                            {desc}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
            ))}

            {/* Q8: Program Fit */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                        {questionNumber(8)}
                        <label className="text-base font-semibold text-gray-900 leading-snug">Program Fit: Alignment with Program Objectives — Job Creation <span className="text-red-500">*</span>
                            <span className="block text-sm font-normal text-gray-500 mt-1">Estimation on how many jobs can be created by the end of the 12-month Program</span>
                        </label>
                    </div>
                    <div className="ml-10">
                        <textarea rows={2} value={programFitJobCreation} onChange={e => setProgramFitJobCreation(e.target.value)} className={textareaClass} placeholder="Estimated number of jobs and rationale..." required />
                    </div>
                </div>
            </div>

            {/* Q9: Annual Revenue */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                        {questionNumber(9)}
                        <label className="text-base font-semibold text-gray-900 leading-snug">Annual Revenue (FY26-27) in INR Cr <span className="text-red-500">*</span>
                            <span className="block text-sm font-normal text-gray-500 mt-1">Estimated close for the current year</span>
                        </label>
                    </div>
                    <div className="ml-10">
                        <input type="text" value={annualRevenueFy2627} onChange={e => setAnnualRevenueFy2627(e.target.value)} className={inputClass} placeholder="e.g., 12" required />
                    </div>
                </div>
            </div>

            {/* Q10: Revenue Target 3-Year */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                        {questionNumber(10)}
                        <label className="text-base font-semibold text-gray-900 leading-snug">Revenue Target (3-Year) from the Implementation of Expansion Idea and Assumptions <span className="text-red-500">*</span></label>
                    </div>
                    <div className="ml-10">
                        <textarea rows={3} value={revenueTarget3yAssumptions} onChange={e => setRevenueTarget3yAssumptions(e.target.value)} className={textareaClass} placeholder="3-year revenue target with assumptions..." required />
                    </div>
                </div>
            </div>

            {/* Panel Recommendation */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Panel Recommendation</h2>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="text-base font-semibold text-gray-900 mb-3 block">Final Recommendation <span className="text-red-500">*</span></label>
                        <div className="flex gap-4">
                            {[
                                { value: 'proceed', label: 'Yes', color: 'green' },
                                { value: 'hold', label: 'No', color: 'red' },
                            ].map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 px-6 py-3 rounded-lg border cursor-pointer transition-all min-w-[100px] justify-center ${finalRecommendation === opt.value
                                        ? opt.color === 'green'
                                            ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                                            : 'border-red-500 bg-red-50 ring-1 ring-red-500'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="primeRecommendation"
                                        value={opt.value}
                                        checked={finalRecommendation === opt.value}
                                        onChange={e => setFinalRecommendation(e.target.value as FinalRecommendation)}
                                        className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                                        required
                                    />
                                    <span className="text-sm font-semibold text-gray-700">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-base font-semibold text-gray-900 mb-2 block">Comments <span className="text-red-500">*</span></label>
                        <textarea rows={3} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} className={textareaClass} placeholder="Your comments..." required />
                    </div>
                </div>
            </div>
        </>
    );

    // ========== CORE/SELECT FORM ==========
    const sectionHeader = (letter: string, title: string) => (
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold mr-2">{letter}</span>
                {title}
            </h2>
        </div>
    );

    const coreQuestion = (num: number | string, label: string, sublabel?: string) => (
        <div className="flex items-start gap-3 mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex-shrink-0 mt-0.5">
                {num}
            </span>
            <label className="text-base font-semibold text-gray-900 leading-snug">
                {label} <span className="text-red-500">*</span>
                {sublabel && <span className="block text-sm font-normal text-gray-500 mt-1">{sublabel}</span>}
            </label>
        </div>
    );

    const coreQuestionOptional = (num: number | string, label: string) => (
        <div className="flex items-start gap-3 mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex-shrink-0 mt-0.5">
                {num}
            </span>
            <label className="text-base font-semibold text-gray-900 leading-snug">{label}</label>
        </div>
    );

    const streamBlock = (
        num: number,
        label: string,
        value: StreamStatus | '',
        setValue: (v: StreamStatus) => void,
        comments: string,
        setComments: (v: string) => void,
        placeholder: string
    ) => (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-3">
            <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex-shrink-0 mt-0.5">
                    {num}
                </span>
                <div className="flex-1">
                    <label className="text-sm font-semibold text-gray-900 block mb-2">{label} <span className="text-red-500">*</span></label>
                    <select value={value} onChange={e => setValue(e.target.value as StreamStatus)} className={selectClass} required>
                        <option value="">Select status...</option>
                        {STREAM_STATUS_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="ml-9">
                <textarea rows={2} value={comments} onChange={e => setComments(e.target.value)} className={textareaClass} placeholder={placeholder} required />
            </div>
        </div>
    );

    const renderCoreSelectForm = () => (
        <>
            {/* Section A: Business Overview and Overall Business Health */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {sectionHeader('A', 'Business Overview and Overall Business Health')}
                <div className="p-6 space-y-6">
                    {/* A1-A2: Revenue fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            {coreQuestion(1, 'Annual Revenue (FY25-26: Q1-Q3 Actuals) in INR Cr')}
                            <div className="ml-9">
                                <input type="number" step="0.01" value={annualRevenueActuals} onChange={e => setAnnualRevenueActuals(e.target.value)} className={inputClass} placeholder="e.g., 15" required />
                            </div>
                        </div>
                        <div>
                            {coreQuestion(2, 'Projected Annual Revenue (FY26) in INR Cr')}
                            <div className="ml-9">
                                <input type="number" step="0.01" value={projectedAnnualRevenue} onChange={e => setProjectedAnnualRevenue(e.target.value)} className={inputClass} placeholder="e.g., 25" required />
                            </div>
                        </div>
                    </div>

                    {/* A3: Financial Health Rating */}
                    <div>
                        {coreQuestion(3, 'Rate - Financial Health')}
                        <div className="ml-9">
                            <StarRating value={ratingFinancialHealth} onChange={setRatingFinancialHealth} label="" />
                        </div>
                    </div>

                    {/* A4: Financial Health Insights */}
                    <div>
                        {coreQuestion(4, 'Your Insights on Financial Health', 'Are they struggling for Working Capital / Debt / Ability to raise capital')}
                        <div className="ml-9">
                            <textarea rows={3} value={insightsFinancialHealth} onChange={e => setInsightsFinancialHealth(e.target.value)} className={textareaClass} placeholder="Share your insights on the venture's financial health..." required />
                        </div>
                    </div>

                    {/* A5: Leadership Rating */}
                    <div>
                        {coreQuestion(5, 'Rate - Leadership Capability & Coachability')}
                        <div className="ml-9">
                            <StarRating value={ratingLeadership} onChange={setRatingLeadership} label="" />
                        </div>
                    </div>

                    {/* A6: Leadership Insights */}
                    <div>
                        {coreQuestion(6, 'Insights on Leadership Capability & Coachability')}
                        <div className="ml-9">
                            <textarea rows={3} value={insightsLeadership} onChange={e => setInsightsLeadership(e.target.value)} className={textareaClass} placeholder="Share your insights on the leadership's capability and coachability..." required />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section B: Venture Definition and Evaluation */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {sectionHeader('B', 'Venture Definition and Evaluation')}
                <div className="p-6 space-y-6">
                    {/* B1: Details of the growth idea */}
                    <div>
                        <div className="flex items-start gap-3 mb-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold flex-shrink-0 mt-0.5">
                                1
                            </span>
                            <div>
                                <label className="text-base font-semibold text-gray-900 leading-snug">
                                    Details of the growth idea <span className="text-red-500">*</span>
                                </label>
                                <p className="text-sm text-gray-500 mt-1">Is the growth idea focused on a new product/service, a new customer segment, or expansion into a new geography? (Select one or more)</p>
                            </div>
                        </div>
                        <div className="ml-9 flex flex-wrap gap-3">
                            {[
                                { value: 'new_product', label: 'New Product or Service' },
                                { value: 'new_customer', label: 'New type of customer' },
                                { value: 'new_geography', label: 'New place, city or country' },
                            ].map(opt => {
                                const isSelected = growthIdeaTypes.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                            setGrowthIdeaTypes(prev =>
                                                prev.includes(opt.value)
                                                    ? prev.filter(v => v !== opt.value)
                                                    : [...prev, opt.value]
                                            );
                                        }}
                                        className={`px-5 py-2.5 rounded-full border text-sm font-medium transition-all ${isSelected
                                            ? 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500'
                                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* B1a: Describe new Product or Service (conditional) */}
                    {growthIdeaTypes.includes('new_product') && (
                        <div>
                            {coreQuestion('1a', 'Describe the new Product or Service')}
                            <div className="ml-9">
                                <textarea rows={3} value={describeNewProduct} onChange={e => setDescribeNewProduct(e.target.value)} className={textareaClass} placeholder="Describe the new product or service..." required />
                            </div>
                        </div>
                    )}

                    {/* B1b: Describe new Target Customer (conditional) */}
                    {growthIdeaTypes.includes('new_customer') && (
                        <div>
                            {coreQuestion('1b', 'Describe the new Target Customer (who and how you sell)')}
                            <div className="ml-9">
                                <textarea rows={3} value={describeNewCustomer} onChange={e => setDescribeNewCustomer(e.target.value)} className={textareaClass} placeholder="Describe the new target customer..." required />
                            </div>
                        </div>
                    )}

                    {/* B1c: Describe new place for expansion (conditional) */}
                    {growthIdeaTypes.includes('new_geography') && (
                        <div>
                            {coreQuestion('1c', 'Describe the new place for expansion (city, state, or country)')}
                            <div className="ml-9">
                                <textarea rows={3} value={describeNewGeography} onChange={e => setDescribeNewGeography(e.target.value)} className={textareaClass} placeholder="Describe the new place for expansion..." required />
                            </div>
                        </div>
                    )}

                    {/* B2: Current Progress */}
                    <div>
                        {coreQuestion(2, 'Current Progress on Expansion Idea')}
                        <div className="ml-9">
                            <textarea rows={3} value={currentProgress} onChange={e => setCurrentProgress(e.target.value)} className={textareaClass} placeholder="What progress has been made so far on this expansion idea?" required />
                        </div>
                    </div>

                    {/* B3: Incremental Revenue */}
                    <div>
                        {coreQuestion(3, 'Independent Assessment of Incremental Revenue (3-Year) in INR Cr', 'From the Implementation of Expansion Idea')}
                        <div className="ml-9">
                            <input type="number" step="0.01" value={incrementalRevenue3y} onChange={e => setIncrementalRevenue3y(e.target.value)} className={inputClass} placeholder="e.g., 10" required />
                        </div>
                    </div>

                    {/* B4: Incremental Jobs */}
                    <div>
                        {coreQuestion(4, 'Incremental Jobs in Next 3 Years (Direct + Indirect)', 'From the Implementation of Expansion Idea — Your Estimation along with Rationale')}
                        <div className="ml-9">
                            <textarea rows={3} value={incrementalJobs3y} onChange={e => setIncrementalJobs3y(e.target.value)} className={textareaClass} placeholder="Provide your estimation along with rationale..." required />
                        </div>
                    </div>

                    {/* B5: Clarity Rating */}
                    <div>
                        {coreQuestion(5, 'Clarity of Expansion Idea')}
                        <div className="ml-9">
                            <StarRating value={ratingClarityExpansion} onChange={setRatingClarityExpansion} label="" />
                        </div>
                    </div>

                    {/* B6: Clarity Comments */}
                    <div>
                        {coreQuestion(6, 'Comments on Clarity of Expansion Idea')}
                        <div className="ml-9">
                            <textarea rows={3} value={commentsClarityExpansion} onChange={e => setCommentsClarityExpansion(e.target.value)} className={textareaClass} placeholder="Share your comments on the clarity of the expansion idea..." required />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section C: Support Required (Execution Streams Assessment) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {sectionHeader('C', 'Support Required (Execution Streams Assessment)')}
                <div className="p-6 space-y-4">
                    {streamBlock(1, 'GTM & Market Expansion', streamGtm, setStreamGtm as (v: StreamStatus) => void, streamGtmComments, setStreamGtmComments, 'Comments on GTM & Market Expansion...')}
                    {streamBlock(2, 'Product & Quality', streamProductQuality, setStreamProductQuality as (v: StreamStatus) => void, streamProductQualityComments, setStreamProductQualityComments, 'Comments on Product & Quality...')}
                    {streamBlock(3, 'Operations', streamOperations, setStreamOperations as (v: StreamStatus) => void, streamOperationsComments, setStreamOperationsComments, 'Comments on Operations...')}
                    {streamBlock(4, 'Supply Chain', streamSupplyChain, setStreamSupplyChain as (v: StreamStatus) => void, streamSupplyChainComments, setStreamSupplyChainComments, 'Comments on Supply Chain...')}
                    {streamBlock(5, 'Organizational Design', streamOrgDesign, setStreamOrgDesign as (v: StreamStatus) => void, streamOrgDesignComments, setStreamOrgDesignComments, 'Comments on Organizational Design...')}
                    {streamBlock(6, 'Finance — Financial Readiness, Cashflow and Capital Adequacy for Expansion', streamFinance, setStreamFinance as (v: StreamStatus) => void, streamFinanceComments, setStreamFinanceComments, 'Comments on Finance...')}

                    <div className="border-t border-gray-200 pt-4">
                        {coreQuestion(7, 'Any other support required (not listed above), based on business needs and your proposal')}
                        <div className="ml-9">
                            <textarea rows={3} value={supportTypeProposal} onChange={e => setSupportTypeProposal(e.target.value)} className={textareaClass} placeholder="Describe the support required and your proposal..." required />
                        </div>
                    </div>
                    <div>
                        {coreQuestion(8, 'Risks or Red Flags (if any)')}
                        <div className="ml-9">
                            <textarea rows={3} value={risksRedFlags} onChange={e => setRisksRedFlags(e.target.value)} className={textareaClass} placeholder="Any risks or red flags identified?" required />
                        </div>
                    </div>
                </div>
            </div>

            {/* Section D: Recommendation */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {sectionHeader('D', 'Recommendation')}
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            {coreQuestion(1, 'Final Recommendation')}
                            <div className="ml-9 flex gap-3">
                                {[
                                    { value: 'proceed', label: 'Proceed', color: 'green' },
                                    { value: 'hold', label: 'Hold', color: 'amber' },
                                    { value: 'revisit_later', label: 'Revisit Later', color: 'gray' },
                                ].map(opt => (
                                    <label
                                        key={opt.value}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${finalRecommendation === opt.value
                                            ? opt.color === 'green'
                                                ? 'border-green-500 bg-green-50 ring-1 ring-green-500'
                                                : opt.color === 'amber'
                                                    ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500'
                                                    : 'border-gray-500 bg-gray-100 ring-1 ring-gray-500'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="finalRecommendation"
                                            value={opt.value}
                                            checked={finalRecommendation === opt.value}
                                            onChange={e => setFinalRecommendation(e.target.value as FinalRecommendation)}
                                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                                            required
                                        />
                                        <span className="text-sm font-semibold text-gray-700">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            {coreQuestionOptional(2, 'Program Category')}
                            <div className="ml-9 flex gap-3">
                                {[
                                    { value: 'core', label: 'Core' },
                                    { value: 'select', label: 'Select' },
                                ].map(opt => (
                                    <label
                                        key={opt.value}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border cursor-pointer transition-all ${programCategory === opt.value
                                            ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="programCategory"
                                            value={opt.value}
                                            checked={programCategory === opt.value}
                                            onChange={e => setProgramCategory(e.target.value as ProgramCategory)}
                                            className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                                        />
                                        <span className="text-sm font-semibold text-gray-700">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div>
                        {coreQuestionOptional(3, 'Additional Notes')}
                        <div className="ml-9">
                            <textarea rows={3} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} className={textareaClass} placeholder="Any additional observations or notes..." />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <button onClick={goBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Dashboard</span>
            </button>

            <div className="mb-8 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h1 className="text-2xl font-bold text-gray-900">
                    {isPrime ? 'Accelerate Prime — Panel Interview Feedback Form' : 'Accelerate Panel Interview Feedback Form'}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-gray-500">Venture:</span>
                    <span className="text-sm font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded-full">{ventureName}</span>
                </div>
            </div>

            {readOnly && (
                <div className="mb-6 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-green-900">Feedback submitted successfully</p>
                        <p className="text-xs text-green-700">This form is now read-only. Your responses have been recorded.</p>
                    </div>
                </div>
            )}

            <fieldset disabled={readOnly} className="space-y-8">
                {isPrime ? renderPrimeForm() : renderCoreSelectForm()}

                {!readOnly && (
                    <div className="flex justify-end gap-3 pb-8">
                        <button type="button" onClick={goBack} className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            onClick={handleSubmit as any}
                            className="px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {submitting ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                    </div>
                )}

                {readOnly && (
                    <div className="flex justify-end pb-8">
                        <button type="button" onClick={goBack} className="px-8 py-3 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm">
                            Back to Dashboard
                        </button>
                    </div>
                )}
            </fieldset>
        </div>
    );
};
