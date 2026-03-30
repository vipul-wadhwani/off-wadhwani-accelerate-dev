import React, { useEffect, useState } from 'react';
import { formatRevenue, formatEmployees } from '../utils/formatters';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';

const STEPS = [
    { id: 1, label: 'BUSINESS' },
    { id: 2, label: 'GROWTH IDEA' },
    { id: 3, label: 'SUPPORT' },
];

// Read-only field component
const ReadOnlyField: React.FC<{ label: string; value: string | undefined; multiline?: boolean }> = ({ label, value, multiline }) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {label}
        </label>
        {multiline ? (
            <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm text-gray-900 min-h-[80px] whitespace-pre-wrap">
                {value || <span className="text-gray-400 italic">Not provided</span>}
            </div>
        ) : (
            <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm text-gray-900">
                {value || <span className="text-gray-400 italic">Not provided</span>}
            </div>
        )}
    </div>
);

export const VentureDetails: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const { toast } = useToast();
    const [venture, setVenture] = useState<any>(null);
    const [streams, setStreams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id && user) {
            fetchVenture(id);
        }
    }, [id, user]);

    const fetchVenture = async (ventureId: string) => {
        try {
            const { venture, streams } = await api.getVenture(ventureId);
            setVenture(venture);
            setStreams(streams || []);
        } catch (err) {
            console.error('Error fetching venture:', err);
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!venture) return null;

    // Extract data from JSONB fields
    const growthCurrent = venture.growth_current || {};
    const growthTarget = venture.growth_target || {};
    const commitment = venture.commitment || {};

    // Determine growth types selected
    const growthFocusRaw = venture.growth_focus || '';
    const growthTypes = (Array.isArray(growthFocusRaw) ? growthFocusRaw : String(growthFocusRaw).split(',')).map((s: string) => s.trim().toLowerCase()).filter(Boolean);

    return (
        <div className="min-h-screen bg-gray-50/50 py-8 px-4">
            <div className="max-w-2xl mx-auto space-y-6 pb-16">

                {/* Back button */}
                <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Ventures
                </button>

                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">{venture.name}</h1>
                    <p className="text-sm text-gray-500 mt-1">Application submitted by {venture.founder_name || user?.user_metadata?.full_name || 'Founder'}</p>
                    <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        Read-only Application
                    </span>
                </div>

                {/* Step Progress Bar (all completed) */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center">
                        {STEPS.map((step, idx) => (
                            <React.Fragment key={step.id}>
                                <div className="flex flex-col items-center gap-1.5 flex-1 py-2 px-3 rounded-xl">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-green-500 text-white">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-widest text-green-600">
                                        {step.label}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className="w-px h-8 bg-gray-200 mx-1" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* ── SECTION 1: BUSINESS ─────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            1
                        </div>
                        <h2 className="text-base font-black text-gray-900 tracking-tight uppercase">
                            Describe Your Current Business
                        </h2>
                    </div>

                    <div className="space-y-6">
                        <ReadOnlyField label="How did you hear about us?" value={growthCurrent.referred_by || venture.referred_by} />
                        <ReadOnlyField label="Name" value={venture.founder_name || user?.user_metadata?.full_name} />
                        <ReadOnlyField label="Email" value={venture.founder_email || growthCurrent.email || user?.email} />
                        <ReadOnlyField label="Mobile" value={growthCurrent.phone || venture.founder_phone} />
                        <ReadOnlyField label="Registered company name" value={venture.name} />
                        <ReadOnlyField label="Designation (Your role in the company)" value={growthCurrent.role || venture.founder_designation} />
                        <ReadOnlyField label="Which city is your company primarily based in" value={growthCurrent.city || venture.city} />
                        <ReadOnlyField label="State in which your company is located" value={growthCurrent.state || venture.state} />
                        <ReadOnlyField label="Company type" value={growthCurrent.business_type || venture.company_type} />
                        <ReadOnlyField label="What do you sell" value={growthCurrent.product || venture.what_do_you_sell} multiline />
                        <ReadOnlyField label="Who do you sell to" value={growthCurrent.segment || venture.who_do_you_sell_to} multiline />
                        <ReadOnlyField label="Which regions do you sell to" value={growthCurrent.geography || venture.which_regions} multiline />
                        <ReadOnlyField label="Number of full time employees" value={(() => { const emp = formatEmployees(growthCurrent.employees || venture.full_time_employees); return emp.breakdown ? `${emp.total} (${emp.breakdown})` : emp.total; })()} />
                        <ReadOnlyField label="What was your company's revenue in the last 12 months" value={formatRevenue(commitment.lastYearRevenue || venture.revenue_12m)} />
                    </div>
                </div>

                {/* ── SECTION 2: GROWTH IDEA ──────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            2
                        </div>
                        <h2 className="text-base font-black text-gray-900 tracking-tight uppercase">
                            Tell Us About Your Growth Idea
                        </h2>
                    </div>

                    <div className="space-y-8">
                        {/* Growth type selection (read-only pills) */}
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Is your growth idea delivering a new product/service or targeting a new segment or looking to enter a new geography?
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { key: 'product', label: 'NEW PRODUCT OR SERVICE' },
                                    { key: 'segment', label: 'NEW TYPE OF CUSTOMER' },
                                    { key: 'geography', label: 'NEW PLACE, CITY OR COUNTRY' },
                                ]).map(({ key, label }) => (
                                    <div
                                        key={key}
                                        className={`px-2.5 py-3.5 rounded-xl text-[10px] font-bold tracking-wide text-center border ${growthTypes.includes(key)
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white border-gray-200 text-gray-400'
                                            }`}
                                    >
                                        {label}
                                    </div>
                                ))}
                            </div>

                            {/* Conditional descriptions */}
                            {growthTypes.includes('product') && (
                                <ReadOnlyField label="Describe your new Product or Service" value={growthTarget.product || venture.focus_product} multiline />
                            )}
                            {growthTypes.includes('segment') && (
                                <ReadOnlyField label="Describe your new Target Customer (who and how you sell)" value={growthTarget.segment || venture.focus_segment} multiline />
                            )}
                            {growthTypes.includes('geography') && (
                                <ReadOnlyField label="Describe the new place you want to expand to (city, state, or country)" value={growthTarget.geography || venture.focus_geography} multiline />
                            )}
                        </div>

                        <ReadOnlyField
                            label="Expected incremental revenue from this growth idea over the next 3 years (₹ Crore)"
                            value={formatRevenue(commitment.revenuePotential || venture.revenue_potential_3y)}
                        />
                        <ReadOnlyField
                            label="How do you plan to fund this growth idea"
                            value={commitment.incrementalHiring || venture.incremental_hiring}
                        />
                    </div>
                </div>

                {/* ── SECTION 3: SUPPORT ──────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            3
                        </div>
                        <h2 className="text-base font-black text-gray-900 tracking-tight uppercase">
                            Which Areas Do You Need Support With?
                        </h2>
                    </div>

                    <div className="space-y-6">
                        {/* Functional Areas table */}
                        <div>
                            <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-100">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Functional Area</span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Status</span>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {streams.length > 0 ? (
                                    streams.map((stream: any) => (
                                        <div key={stream.id || stream.stream_name} className="grid grid-cols-2 gap-4 items-center py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-gray-800">{stream.stream_name}</span>
                                            </div>
                                            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${stream.status === 'Not started' || stream.status === "Don't need help"
                                                    ? 'bg-gray-100 text-gray-600'
                                                    : stream.status === 'Need some advice' || stream.status === 'Need some guidance' || stream.status === 'Work in Progress'
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : stream.status === 'Need deep support'
                                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                                            : stream.status === 'Done'
                                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                                : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {stream.status}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-400 italic py-4 text-sm">No support areas recorded.</p>
                                )}
                            </div>
                        </div>

                        {/* Support Description */}
                        <ReadOnlyField
                            label="Describe in detail the support you are seeking from the program"
                            value={venture.support_request}
                            multiline
                        />

                        {/* Corporate Presentation */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                                Corporate Presentation
                            </label>
                            {venture.corporate_presentation_url ? (
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
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
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-semibold"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        Download
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm text-gray-400 italic">
                                    No corporate presentation uploaded
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
