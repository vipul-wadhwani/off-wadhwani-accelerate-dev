import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Loader2, Mic, Info, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { StatusSelect } from '../components/StatusSelect';
import { PhoneInput } from '../components/PhoneInput';
import { useToast } from '../components/ui/Toast';

// Steps configuration - matching the reference screens exactly
const STEPS = [
    { id: 1, label: 'BUSINESS' },
    { id: 2, label: 'GROWTH IDEA' },
    { id: 3, label: 'SUPPORT' },
];

// Functional Areas for Step 3 (Support) - matching the reference screen
const WORKSTREAMS = [
    'Product',
    'Go-To-Market (GTM)',
    'Capital Planning',
    'Team',
    'Supply Chain',
    'Operations',
];

// Tooltip content per functional area
const WORKSTREAM_INFO: Record<string, string> = {
    'Product': 'Improving or refining your product/service to better fit customer needs and support growth.',
    'Go-To-Market (GTM)': 'Support in acquiring customers, entering new markets, pricing, sales channels, or marketing.',
    'Capital Planning': 'Help with funding strategy, investor readiness, working capital, or financial planning for growth.',
    'Team': 'Hiring key roles, building leadership capability, or strengthening team structure for scale.',
    'Supply Chain': 'Improving vendors, sourcing, logistics, distribution, or delivery capacity to handle growth.',
    'Operations': 'Making processes, systems, and execution more efficient to scale smoothly and profitably.',
};

type GrowthType = 'product' | 'segment' | 'geography';

export const NewApplication: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedGrowthTypes, setSelectedGrowthTypes] = useState<GrowthType[]>([]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Form State - matching all fields from the 4 screens
    const [formData, setFormData] = useState({
        // Step 1: Business
        businessName: '',
        managingDirector: '',
        whatDoYouSell: '',
        whoDoYouSellTo: '',
        whichRegions: '',

        // Step 2: Growth Idea
        growthFocus: [] as GrowthType[],
        focusProduct: '',
        focusSegment: '',
        focusGeography: '',
        revenuePotential12m: '',
        targetJobs: '',
        requestedInvestmentLimit: '',
        incrementalHiring: '',
        city: '',
        state: '',
        email: '',
        phone: '',
        role: '', // Added role field
        lastYearRevenue: '',
        companyType: '',
        referredBy: '',
        numberOfEmployees: '',
        financialCondition: '',

        // Step 3: Support
        workstreamStatuses: WORKSTREAMS.map(w => ({ stream: w, status: 'Don\'t need help' })),
        supportDescription: '',
        timeCommitment: '',
        secondLineTeam: '',
        corporatePresentation: null as File | null,
    });

    const validateField = (field: string, value: string): string => {
        switch (field) {
            case 'phone':
                // Phone validation - format is now "+91 9876543210"
                if (!value) return '';

                // Extract country code and phone number part
                const phoneMatch = value.match(/\+(\d{1,4})\s+(\d+)/);
                if (!phoneMatch) {
                    return 'Please enter a valid phone number';
                }

                const countryCode = `+${phoneMatch[1]}`;
                const phoneDigits = phoneMatch[2];

                // Define expected digits per country (matching PhoneInput component)
                const expectedDigits: Record<string, number> = {
                    '+91': 10,  // India
                    '+1': 10,   // United States
                    '+44': 10,  // United Kingdom
                    '+971': 9,  // UAE
                    '+65': 8,   // Singapore
                };

                const requiredLength = expectedDigits[countryCode] || 10;

                if (phoneDigits.length !== requiredLength) {
                    const countryName = countryCode === '+91' ? 'India' : 'this country';
                    return `Phone number must be exactly ${requiredLength} digits for ${countryName}`;
                }
                break;
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return 'Please enter a valid email address';
                }
                break;
        }
        return '';
    };

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Validate on change for specific fields
        if (['phone', 'email'].includes(field)) {
            const error = validateField(field, value);
            setValidationErrors(prev => ({
                ...prev,
                [field]: error
            }));
        }
    };

    const updateWorkstreamStatus = (index: number, status: string) => {
        const updated = [...formData.workstreamStatuses];
        updated[index] = { ...updated[index], status };
        setFormData(prev => ({ ...prev, workstreamStatuses: updated }));
    };

    const toggleGrowthType = (type: GrowthType) => {
        const updated = selectedGrowthTypes.includes(type)
            ? selectedGrowthTypes.filter(t => t !== type)
            : [...selectedGrowthTypes, type];
        setSelectedGrowthTypes(updated);
        setFormData(prev => ({ ...prev, growthFocus: updated }));
    };

    const handleSubmit = async () => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            // 1. Create Venture via API
            const { venture } = await api.createVenture({
                name: formData.businessName,
                founder_name: formData.managingDirector,
                program: 'Accelerate',
                growth_current: {
                    product: formData.whatDoYouSell,
                    segment: formData.whoDoYouSellTo,
                    geography: formData.whichRegions,
                    city: formData.city,
                    state: formData.state,
                    business_type: formData.companyType,
                    referred_by: formData.referredBy,
                    employees: formData.numberOfEmployees,
                    role: formData.role,
                    email: formData.email,
                    phone: formData.phone,
                },
                growth_focus: formData.growthFocus.join(','),
                growth_target: {
                    product: formData.focusProduct,
                    segment: formData.focusSegment,
                    geography: formData.focusGeography
                },
                commitment: {
                    investment: formData.requestedInvestmentLimit,
                    incrementalHiring: formData.incrementalHiring,
                    lastYearRevenue: formData.lastYearRevenue,
                    revenuePotential: formData.revenuePotential12m, // Question asks "next 3 years"
                    targetJobs: formData.targetJobs,
                    financialCondition: formData.financialCondition,
                    timeCommitment: formData.timeCommitment,
                    secondLineTeam: formData.secondLineTeam,
                },
                blockers: '',
                support_request: formData.supportDescription,
            });

            logger.info('Application', `Venture created: ${venture.id}`);

            // 2. Upload corporate presentation (non-blocking)
            if (formData.corporatePresentation) {
                try {
                    await api.uploadVentureDocument(venture.id, formData.corporatePresentation);
                    logger.info('Application', `Document uploaded for venture ${venture.id}`);
                } catch (uploadErr) {
                    logger.error('Application', 'Document upload failed (non-blocking)', uploadErr);
                }
            }

            // 3. Create Venture Streams via API
            // Map frontend status values to database constraint values
            const statusMapping: Record<string, string> = {
                "Don't need help": "Not started",
                "Need some guidance": "Need some advice",
                "Need deep support": "Need deep support"
            };

            for (const ws of formData.workstreamStatuses) {
                const dbStatus = statusMapping[ws.status] || "Not started";
                await api.createStream(venture.id, {
                    stream_name: ws.stream,
                    status: dbStatus,
                });
            }

            // 4. Submit the venture
            await api.submitVenture(venture.id);
            logger.info('Application', `Venture submitted: ${venture.id}`);

            setIsSubmitted(true);
        } catch (err) {
            logger.error('Application', 'Error submitting application', err);
            toast('Failed to submit application. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = () => {
        // Validate current step before proceeding
        const hasErrors = Object.values(validationErrors).some(error => error !== '');

        if (hasErrors) {
            toast('Please fix the validation errors before proceeding.', 'warning');
            return;
        }

        if (currentStep < 3) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(prev => prev - 1);
    };

    // ─── Success Screen ───────────────────────────────────────────────────────
    if (isSubmitted) {
        return (
            <div className="max-w-xl mx-auto pt-10">
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
                    <p className="text-gray-500">
                        Thanks for applying, we will get back to you shortly.
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-3.5 px-6 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        Okay
                    </button>
                </div>
            </div>
        );
    }

    // ─── Step Header ─────────────────────────────────────────────────────────
    const stepTitles: Record<number, string> = {
        1: 'DESCRIBE YOUR CURRENT BUSINESS',
        2: 'TELL US ABOUT YOUR GROWTH IDEA',
        3: 'WHICH AREAS DO YOU NEED SUPPORT WITH?',
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-16">

            {/* ── Page Header (Step 2+) */}
            {currentStep >= 2 && (
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                        Accelerate Application
                    </h1>
                </div>
            )}

            {/* ── Step Progress Bar ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center">
                    {STEPS.map((step, idx) => {
                        const isCompleted = step.id < currentStep;
                        const isActive = step.id === currentStep;
                        return (
                            <React.Fragment key={step.id}>
                                <div
                                    className={`flex flex-col items-center gap-1.5 flex-1 py-2 px-3 rounded-xl transition-colors ${isActive ? 'bg-blue-50' : ''}`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${isCompleted
                                            ? 'bg-green-500 text-white'
                                            : isActive
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white border-2 border-gray-200 text-gray-400'
                                            }`}
                                    >
                                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                                    </div>
                                    <span
                                        className={`text-[10px] font-bold tracking-widest ${isCompleted
                                            ? 'text-green-600'
                                            : isActive
                                                ? 'text-blue-600'
                                                : 'text-gray-400'
                                            }`}
                                    >
                                        {step.label}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className="w-px h-8 bg-gray-200 mx-1" />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* ── Step Content Card ─────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">

                {/* Foundation support message - Step 2 only */}
                {currentStep === 2 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                        <p className="text-sm text-gray-700 leading-relaxed">
                            The Foundation offers deeper support to businesses working on growth initiatives with meaningful incremental revenue potential - like launching or improving a product, entering a new customer segment, or expanding into a new market, etc <span className="font-bold text-blue-700">at NO COST</span>
                        </p>
                    </div>
                )}

                {/* Step Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {currentStep}
                    </div>
                    <h2 className="text-base font-black text-gray-900 tracking-tight uppercase">
                        {stepTitles[currentStep]}
                    </h2>
                </div>

                {/* ── STEP 1: BUSINESS ─────────────────────────────────────── */}
                {currentStep === 1 && (
                    <div className="space-y-6">
                        {/* 1. How did you hear about us? */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                How did you hear about us?
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="E.g., LinkedIn, referral, event..."
                                value={formData.referredBy}
                                onChange={e => updateField('referredBy', e.target.value)}
                            />
                        </div>

                        {/* 2. Name */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Name
                                </label>
                                <Mic className="w-4 h-4 text-gray-300" />
                            </div>
                            <input
                                type="text"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="E.g., Rajesh Kumar"
                                value={formData.managingDirector}
                                onChange={e => updateField('managingDirector', e.target.value)}
                            />
                        </div>

                        {/* 3. Email */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Email
                            </label>
                            <input
                                type="email"
                                className={`w-full rounded-xl border ${validationErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'} px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all`}
                                placeholder="E.g., yourname@company.com"
                                value={formData.email}
                                onChange={e => updateField('email', e.target.value)}
                            />
                            {validationErrors.email && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <span>⚠</span> {validationErrors.email}
                                </p>
                            )}
                        </div>

                        {/* 4. Mobile */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Mobile
                            </label>
                            <PhoneInput
                                value={formData.phone}
                                onChange={(value) => updateField('phone', value)}
                                error={validationErrors.phone}
                                placeholder="9876543210"
                            />
                        </div>

                        {/* 5. Registered company name */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Registered company name
                                </label>
                                <Mic className="w-4 h-4 text-gray-300" />
                            </div>
                            <input
                                type="text"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="Enter registered business name"
                                value={formData.businessName}
                                onChange={e => updateField('businessName', e.target.value)}
                            />
                        </div>

                        {/* 6. Designation (Your role in the company) */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Designation (Your role in the company)
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="E.g., CEO, Co-Founder"
                                value={formData.role}
                                onChange={e => updateField('role', e.target.value)}
                            />
                        </div>

                        {/* 7. Which city is your company primarily based in */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Which city is your company primarily based in
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="E.g., Mumbai"
                                value={formData.city}
                                onChange={e => updateField('city', e.target.value)}
                            />
                        </div>

                        {/* 8. State in which your company is located */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                State in which your company is located
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                value={formData.state}
                                onChange={e => updateField('state', e.target.value)}
                            >
                                <option value="" disabled>Select state...</option>
                                <option value="Gujarat">Gujarat</option>
                                <option value="Maharashtra">Maharashtra</option>
                                <option value="Tamil Nadu">Tamil Nadu</option>
                                <option value="Karnataka">Karnataka</option>
                                <option value="Uttar Pradesh">Uttar Pradesh</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* 9. Company type */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Company type
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                value={formData.companyType}
                                onChange={e => updateField('companyType', e.target.value)}
                            >
                                <option value="" disabled>Select company type...</option>
                                <option value="Manufacturing">Manufacturing</option>
                                <option value="Services">Services</option>
                                <option value="Consumer/D2C">Consumer/D2C</option>
                                <option value="Trading">Trading</option>
                                <option value="Startups">Startups</option>
                            </select>
                        </div>

                        {/* 10. What do you sell */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    What do you sell
                                </label>
                                <Mic className="w-4 h-4 text-gray-300" />
                            </div>
                            <textarea
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[110px] resize-none"
                                placeholder="Describe your current products and services..."
                                value={formData.whatDoYouSell}
                                onChange={e => updateField('whatDoYouSell', e.target.value)}
                            />
                        </div>

                        {/* 11. Who do you sell to */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Who do you sell to
                                </label>
                                <Mic className="w-4 h-4 text-gray-300" />
                            </div>
                            <textarea
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[110px] resize-none"
                                placeholder="Describe your customer segments..."
                                value={formData.whoDoYouSellTo}
                                onChange={e => updateField('whoDoYouSellTo', e.target.value)}
                            />
                        </div>

                        {/* 12. Which regions do you sell to */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Which regions do you sell to
                                </label>
                                <Mic className="w-4 h-4 text-gray-300" />
                            </div>
                            <textarea
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[110px] resize-none"
                                placeholder="Describe the geographies and regions you cover..."
                                value={formData.whichRegions}
                                onChange={e => updateField('whichRegions', e.target.value)}
                            />
                        </div>

                        {/* 13. Number of full time employees */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Number of full time employees
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                value={formData.numberOfEmployees}
                                onChange={e => updateField('numberOfEmployees', e.target.value)}
                            >
                                <option value="" disabled>Select number of employees...</option>
                                <option value="<10">&lt;10</option>
                                <option value="10-25">10 - 25</option>
                                <option value="25-100">25 - 100</option>
                                <option value=">100">&gt;100</option>
                            </select>
                        </div>

                        {/* Financial Condition */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                What is your company's current financial condition?
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                value={formData.financialCondition}
                                onChange={e => updateField('financialCondition', e.target.value)}
                            >
                                <option value="" disabled>Select financial condition...</option>
                                <option value="PAT profitable and cash positive">PAT profitable and cash positive</option>
                                <option value="Not yet profitable but have 12+ months runway">Not yet profitable but have 12+ months runway</option>
                                <option value="6-12 months runway available">6–12 months runway available</option>
                                <option value="Less than 6 months runway">Less than 6 months runway</option>
                            </select>
                        </div>

                        {/* 14. What was your company's revenue in the last 12 months */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                What was your company's revenue in the last 12 months (in Cr)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="Enter revenue in Cr (e.g. 10)"
                                value={formData.lastYearRevenue}
                                onChange={e => updateField('lastYearRevenue', e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* ── STEP 2: GROWTH IDEA ──────────────────────────────────────── */}
                {currentStep === 2 && (
                    <div className="space-y-8">
                        {/* Growth type question */}
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Is your growth idea delivering a new product/service or targeting a new segment or looking to enter a new geography?
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { key: 'product' as GrowthType, label: 'NEW PRODUCT OR SERVICE' },
                                    { key: 'segment' as GrowthType, label: 'NEW TYPE OF CUSTOMER' },
                                    { key: 'geography' as GrowthType, label: 'NEW PLACE, CITY OR COUNTRY' },
                                ]).map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => toggleGrowthType(key)}
                                        className={`px-2.5 py-3.5 rounded-xl text-[10px] font-bold tracking-wide transition-all border whitespace-nowrap ${selectedGrowthTypes.includes(key)
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25'
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Conditional textareas — appear when toggle is selected */}
                            {selectedGrowthTypes.includes('product') && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            Describe your new Product or Service
                                        </label>
                                        <Mic className="w-4 h-4 text-gray-300" />
                                    </div>
                                    <textarea
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[110px] resize-none"
                                        placeholder="What is your new Product or Service&#10;Example: Launching a new ready-to-eat poha snack."
                                        value={formData.focusProduct}
                                        onChange={e => updateField('focusProduct', e.target.value)}
                                    />
                                </div>
                            )}

                            {selectedGrowthTypes.includes('segment') && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            Describe your new Target Customer (who and how you sell)
                                        </label>
                                        <Mic className="w-4 h-4 text-gray-300" />
                                    </div>
                                    <textarea
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[110px] resize-none"
                                        placeholder="Who is this product for, and how will you sell it (online and in stores)&#10;Example: Sell this ready-to-eat poha snack to small kirana stores and local retailers through distributors."
                                        value={formData.focusSegment}
                                        onChange={e => updateField('focusSegment', e.target.value)}
                                    />
                                </div>
                            )}

                            {selectedGrowthTypes.includes('geography') && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                            Describe the new place you want to expand to (city, state, or country)
                                        </label>
                                        <Mic className="w-4 h-4 text-gray-300" />
                                    </div>
                                    <textarea
                                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[110px] resize-none"
                                        placeholder="Which city, state or country are you expanding into?&#10;Example: Start in Pune, then expand across Maharashtra."
                                        value={formData.focusGeography}
                                        onChange={e => updateField('focusGeography', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Planned Hires */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                How many people do you plan to hire for this growth idea?
                            </label>
                            <input
                                type="number"
                                min="0"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                placeholder="Enter number of planned hires"
                                value={formData.targetJobs}
                                onChange={e => updateField('targetJobs', e.target.value)}
                            />
                        </div>

                        {/* Incremental Revenue */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Expected incremental revenue from this growth idea over the next 3 years (Enter amount in ₹ Crore)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="e.g., 25"
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                                value={formData.revenuePotential12m}
                                onChange={e => updateField('revenuePotential12m', e.target.value)}
                            />
                        </div>

                        {/* Funding Plan */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                How do you plan to fund this growth idea
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                value={formData.incrementalHiring}
                                onChange={e => updateField('incrementalHiring', e.target.value)}
                            >
                                <option value="" disabled>Choose</option>
                                <option value="Internal Cashflows">Internal Cashflows</option>
                                <option value="Bank Loan or NBFC Financing">Bank Loan or NBFC Financing</option>
                                <option value="Equity oe External Capital">Equity oe External Capital</option>
                                <option value="Yet to be planned">Yet to be planned</option>
                            </select>
                        </div>

                    </div>
                )}

                {/* ── STEP 3: SUPPORT ──────────────────────────────────────── */}
                {currentStep === 3 && (
                    <div className="space-y-6">
                        {/* Functional Areas table */}
                        <div>
                            {/* Header row */}
                            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Functional Area</span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Status</span>
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-gray-100">
                                {formData.workstreamStatuses.map((ws, idx) => (
                                    <div key={ws.stream} className="grid grid-cols-2 gap-4 items-center py-4">
                                        {/* Functional Area name + info tooltip */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-gray-800">{ws.stream}</span>
                                            <div className="relative group">
                                                <Info className="w-3.5 h-3.5 text-gray-300 hover:text-blue-500 cursor-help transition-colors" />
                                                {/* Tooltip */}
                                                <div className="absolute left-5 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block w-72 pointer-events-none">
                                                    <div className="bg-gray-900 text-white rounded-xl p-3.5 shadow-2xl">
                                                        <p className="text-xs text-gray-200 leading-relaxed">
                                                            {WORKSTREAM_INFO[ws.stream]}
                                                        </p>
                                                        {/* Arrow */}
                                                        <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-gray-900 rotate-45" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <StatusSelect
                                            status={ws.status}
                                            onChange={newStatus => updateWorkstreamStatus(idx, newStatus)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Support Description */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    Describe in detail the support you are seeking from the program
                                </label>
                                <Mic className="w-4 h-4 text-gray-300" />
                            </div>
                            <textarea
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all min-h-[120px] resize-none"
                                placeholder="Please be specific. Tell us exactly what kind of help you need from this program and what you want to achieve."
                                value={formData.supportDescription}
                                onChange={e => updateField('supportDescription', e.target.value)}
                            />
                        </div>

                        {/* Owner Involvement */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                As the business owner/promoter, how involved will you be in this new venture?
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                value={formData.timeCommitment}
                                onChange={e => updateField('timeCommitment', e.target.value)}
                            >
                                <option value="" disabled>Select your level of involvement...</option>
                                <option value="Fully involved — Day-to-day involvement">Fully involved — Day-to-day involvement</option>
                                <option value="Actively involved — Not on a daily basis">Actively involved — Not on a daily basis</option>
                                <option value="Partially involved — Limited time alongside other responsibilities">Partially involved — Limited time alongside other responsibilities</option>
                                <option value="Not involved — Will delegate entirely to my team">Not involved — Will delegate entirely to my team</option>
                            </select>
                        </div>

                        {/* Leadership Team */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Do you have a leadership/management team to run the day-to-day operations of this venture?
                            </label>
                            <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                value={formData.secondLineTeam}
                                onChange={e => updateField('secondLineTeam', e.target.value)}
                            >
                                <option value="" disabled>Select...</option>
                                <option value="Yes — Experienced team already in place">Yes — Experienced team already in place</option>
                                <option value="Partially — Some team members identified, still building the team">Partially — Some team members identified, still building the team</option>
                                <option value="No — Dedicated team not yet identified">No — Dedicated team not yet identified</option>
                            </select>
                        </div>

                        {/* Corporate Presentation Upload */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Please upload your corporate presentation to help us understand your business better
                            </label>
                            <p className="text-xs text-gray-400">Accepted: PDF, PPT, PPTX, DOC, DOCX (max 5MB)</p>
                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    id="corporatePresentation"
                                    accept=".pdf,.ppt,.pptx,.doc,.docx"
                                    onChange={e => {
                                        const file = e.target.files?.[0] || null;
                                        if (file && file.size > 5 * 1024 * 1024) {
                                            toast('File size exceeds 5MB limit.', 'warning');
                                            e.target.value = '';
                                            return;
                                        }
                                        setFormData(prev => ({ ...prev, corporatePresentation: file }));
                                    }}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="corporatePresentation"
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer transition-colors text-sm font-medium text-gray-700"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Choose File
                                </label>
                                {formData.corporatePresentation && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">
                                            {formData.corporatePresentation.name}
                                            <span className="text-gray-400 ml-1">
                                                ({(formData.corporatePresentation.size / 1024 / 1024).toFixed(1)}MB)
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, corporatePresentation: null }));
                                                const input = document.getElementById('corporatePresentation') as HTMLInputElement;
                                                if (input) input.value = '';
                                            }}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>

            {/* ── Footer Navigation ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-1">
                {/* Previous Step */}
                <button
                    onClick={handleBack}
                    disabled={currentStep === 1 || isSubmitting}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    PREVIOUS STEP
                </button>

                {/* Cancel */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors"
                >
                    CANCEL
                </button>

                {/* Next / Submit */}
                <button
                    onClick={handleNext}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold uppercase tracking-wider hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                        </>
                    ) : currentStep === 3 ? (
                        <>
                            SUBMIT APPLICATION
                            <Check className="w-4 h-4" />
                        </>
                    ) : (
                        <>
                            NEXT: {STEPS[currentStep].label}
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
