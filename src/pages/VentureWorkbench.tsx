import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ArrowLeft, CheckCircle, FileText, Loader2, Zap, Users, ShieldCheck, ArrowUpRight, Search, Clock, PartyPopper } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

export const VentureWorkbench = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [venture, setVenture] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [showJoinedModal, setShowJoinedModal] = useState(false);
    const [declining, setDeclining] = useState(false);

    useEffect(() => {
        if (id) fetchVentureData();
    }, [id]);

    const fetchVentureData = async () => {
        try {
            if (!id) return;
            // Fetch All Venture Data in one call
            const { venture } = await api.getVenture(id);

            setVenture(venture);

        } catch (error) {
            console.error('Error fetching venture data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        if (!id) return;
        if (!window.confirm('Are you sure you want to decline? This action cannot be undone.')) return;
        setDeclining(true);
        try {
            await api.updateVenture(id, {
                agreement_status: 'Declined',
                status: 'Rejected'
            });
            toast('You have declined the program offer.', 'info');
            navigate('/dashboard');
        } catch (error) {
            console.error('Error declining:', error);
            toast('Failed to decline. Please try again.', 'error');
        } finally {
            setDeclining(false);
        }
    };

    const handleSignAgreement = async () => {
        if (!accepted || !id) return;
        setSigning(true);
        try {
            await api.updateVenture(id, {
                agreement_status: 'Signed',
                agreement_accepted_at: new Date().toISOString(),
                status: 'Joined Program'
            });

            setShowJoinedModal(true);
        } catch (error) {
            console.error('Error signing agreement:', error);
            toast('Failed to sign agreement. Please try again.', 'error');
        } finally {
            setSigning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!venture) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Venture Not Found</h2>
                    <Button onClick={() => navigate('/dashboard')} variant="outline" className="mt-4">
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    const isSigned = venture.agreement_status === 'Signed';
    const isDeclined = venture.status === 'Rejected' || venture.agreement_status === 'Declined';

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-900 -ml-2">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                </div>
                {isSigned && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Joined Program
                    </span>
                )}
                {isDeclined && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                        Declined
                    </span>
                )}
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Workbench Locked Banner - removed */}

                {isDeclined ? (
                    // DECLINED VIEW
                    <div className="max-w-5xl mx-auto">
                        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
                            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck className="w-8 h-8 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Program Offer Declined</h2>
                            <p className="text-gray-500 mb-6">You have declined the program offer for this venture.</p>
                            <Button onClick={() => navigate('/dashboard')} variant="outline">
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>
                ) : !isSigned ? (
                    // SIGNING VIEW
                    <div className="max-w-5xl mx-auto">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Program Details</h1>
                    <div id="growth-plan-section" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

                        <div className="divide-y divide-gray-200">
                            {/* Support provided */}
                            <div className="border-t border-gray-200">
                                <div className="p-6">
                                    {/* Support Provided Content */}
                                    <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
                                                <Zap className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 text-sm tracking-wide">SUPPORT PROVIDED</h3>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Resources & Advisory Access</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <Zap className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Virtual Growth Accelerator</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed group-hover:text-gray-700">Full access to our digital scaling environment.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <Users className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Masterclasses</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Expert-led sessions with industry-specific training.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <FileText className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Stream Overviews</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Strategy & tips developed by experts for each department.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <FileText className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Deliverable Playbooks</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Step-by-step guides for every project milestone.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <Clock className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Expert Hours (Sprint)</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">First 60 days of intensive support.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <Clock className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Expert Hours (Journey)</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Ongoing strategic advisory.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <ArrowUpRight className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Provider Referrals</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Vetted network of verified service providers.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <Search className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Research Reports</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">In-depth market and stream analytics documents.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Venture commitment */}
                            <div className="border-t border-gray-200">
                                <div className="p-6">
                                    <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center">
                                                <ShieldCheck className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 text-sm tracking-wide uppercase">Venture Commitment</h3>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Requirements for participation</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Journey Progression</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Committed to progressing through all journey items as relevant.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Stream SPOCs</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Dedicated points of contact for each functional stream.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Monthly Check-ins</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Regular strategy alignment with Venture Partners.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Direct Funding</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Budget allocation for additional expert requirements.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Testimonials</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Willingness to share success stories and case studies.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Impact Data</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Growth and jobs inputs for our impact reporting team.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Checkbox */}
                            <div className="flex border-t border-gray-200">
                                <div className="p-6 w-full flex items-center gap-4">
                                    <label className="flex items-center gap-4 cursor-pointer group">
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${accepted ? 'bg-black border-black text-white' : 'border-gray-300 group-hover:border-gray-500 bg-white text-transparent'}`}>
                                            <CheckCircle className="w-3.5 h-3.5" strokeWidth={3} />
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={accepted}
                                            onChange={(e) => setAccepted(e.target.checked)}
                                        />
                                        <span className="text-base font-bold text-gray-900">I accept the terms and conditions</span>
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex border-t border-gray-200">
                                <div className="w-1/2 p-4 border-r border-gray-200 flex justify-center">
                                    <Button
                                        variant="outline"
                                        className="w-full max-w-[200px] text-gray-700 border-gray-300 font-bold hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                        disabled={declining}
                                        onClick={handleDecline}
                                    >
                                        {declining ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Declining...
                                            </span>
                                        ) : 'Decline'}
                                    </Button>
                                </div>
                                <div className="w-1/2 p-4 flex justify-center">
                                    <Button
                                        className="w-full max-w-[200px] font-bold text-white bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500"
                                        disabled={!accepted || signing}
                                        onClick={handleSignAgreement}
                                    >
                                        {signing ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                                            </span>
                                        ) : 'Join Program'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                ) : (
                    // READ-ONLY WORKBENCH VIEW (Signed / Joined Program)
                    <div className="max-w-5xl mx-auto">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">Program Details</h1>
                    <div id="growth-plan-section" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Joined Program badge */}
                        <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <span className="text-sm font-bold text-emerald-800">You have joined the program.</span>
                        </div>

                        <div className="divide-y divide-gray-200">
                            {/* Support provided */}
                            <div className="border-t border-gray-200">
                                <div className="p-6">
                                    <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
                                                <Zap className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 text-sm tracking-wide">SUPPORT PROVIDED</h3>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Resources & Advisory Access</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <Zap className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Virtual Growth Accelerator</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Full access to our digital scaling environment.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <Users className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Masterclasses</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Expert-led sessions with industry-specific training.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <FileText className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Stream Overviews</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Strategy & tips developed by experts for each department.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                                <FileText className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Deliverable Playbooks</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Step-by-step guides for every project milestone.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <Clock className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Expert Hours (Sprint)</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">First 60 days of intensive support.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <Clock className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Expert Hours (Journey)</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Ongoing strategic advisory.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <ArrowUpRight className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Provider Referrals</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">Vetted network of verified service providers.</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col">
                                                <Search className="w-5 h-5 text-blue-500 mb-3" />
                                                <h4 className="text-[10px] font-bold text-gray-900 uppercase mb-1.5">Research Reports</h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed">In-depth market and stream analytics documents.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Venture commitment */}
                            <div className="border-t border-gray-200">
                                <div className="p-6">
                                    <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center">
                                                <ShieldCheck className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-gray-900 text-sm tracking-wide uppercase">Venture Commitment</h3>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Requirements for participation</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Journey Progression</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Committed to progressing through all journey items as relevant.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Stream SPOCs</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Dedicated points of contact for each functional stream.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Monthly Check-ins</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Regular strategy alignment with Venture Partners.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Direct Funding</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Budget allocation for additional expert requirements.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Testimonials</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Willingness to share success stories and case studies.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle className="w-3 h-3 text-red-500" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-900 uppercase mb-1">Impact Data</h4>
                                                    <p className="text-[10px] text-gray-500 leading-relaxed">Growth and jobs inputs for our impact reporting team.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                )}
            </div>

            {/* Thanks for joining modal */}
            {showJoinedModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-500/30">
                            <PartyPopper className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Aboard!</h2>
                        <p className="text-gray-600 mb-6">
                            Thank you for joining the <span className="font-semibold text-brand-600">Wadhwani Accelerate</span> program. We're excited to partner with you on your growth journey!
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                            Your Venture Partner will be in touch shortly to begin the alignment phase.
                        </p>
                        <Button
                            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl"
                            onClick={() => {
                                setShowJoinedModal(false);
                                navigate('/dashboard');
                            }}
                        >
                            Okay
                        </Button>
                    </div>
                </div>
            )}
        </div >
    );
};
