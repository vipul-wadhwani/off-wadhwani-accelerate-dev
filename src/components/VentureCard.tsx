import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, LayoutGrid, Calendar, Sparkles } from 'lucide-react';

export interface Venture {
    id: string;
    name: string;
    description: string;
    status: 'Draft' | 'Submitted' | 'Under Review' | 'Panel Review' | 'Approved' | 'Rejected' | 'Agreement Sent' | 'Contract Sent' | 'Joined Program';
    program: 'Accelerate' | 'Ignite' | 'Liftoff';
    location: string;
    submittedAt: string;
    agreement_status?: 'Draft' | 'Sent' | 'Signed' | 'Declined';
    workbench_locked?: boolean;
}

interface VentureCardProps {
    venture: Venture;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    Draft: { bg: 'bg-amber-50 border-amber-200/60', text: 'text-amber-800', dot: 'bg-amber-500' },
    Submitted: { bg: 'bg-brand-50 border-brand-200/60', text: 'text-brand-800', dot: 'bg-brand-500' },
    'Under Review': { bg: 'bg-purple-50 border-purple-200/60', text: 'text-purple-800', dot: 'bg-purple-500' },
    Approved: { bg: 'bg-emerald-50 border-emerald-200/60', text: 'text-emerald-800', dot: 'bg-emerald-500' },
    Rejected: { bg: 'bg-red-50 border-red-200/60', text: 'text-red-800', dot: 'bg-red-500' },
    'Panel Review': { bg: 'bg-amber-50 border-amber-200/60', text: 'text-amber-800', dot: 'bg-amber-500' },
    'Agreement Sent': { bg: 'bg-indigo-50 border-indigo-200/60', text: 'text-indigo-800', dot: 'bg-indigo-500' },
    'Contract Sent': { bg: 'bg-teal-50 border-teal-200/60', text: 'text-teal-800', dot: 'bg-teal-500' },
    'Joined Program': { bg: 'bg-emerald-50 border-emerald-200/60', text: 'text-emerald-800', dot: 'bg-emerald-500' },
};

export const VentureCard: React.FC<VentureCardProps> = ({ venture }) => {
    const navigate = useNavigate();
    // Map "Panel Review" to "Under Review" for entrepreneur-facing display
    const displayStatus = venture.status === 'Panel Review' ? 'Under Review' : venture.status;
    const status = statusConfig[displayStatus] || statusConfig.Draft;

    const initials = venture.name
        .split(/\s+/)
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div
            onClick={() => navigate(`/dashboard/venture/${venture.id}`)}
            className="group bg-white rounded-2xl border border-gray-200 hover:border-brand-300 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
        >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-brand-400 to-brand-500" />

            <div className="p-6">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[16px] font-semibold text-gray-900 truncate group-hover:text-brand-600 transition-colors leading-tight">
                                {venture.name}
                            </h3>
                            {(venture.description || venture.location) && (
                                <p className="text-[13px] text-gray-500 mt-0.5 truncate">
                                    {[venture.description, venture.location].filter(Boolean).join(' · ')}
                                </p>
                            )}
                        </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide flex-shrink-0 border ${status.bg} ${status.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {displayStatus}
                    </span>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 mb-5">
                    {venture.program && (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-600 bg-gray-100 border border-gray-200/80 rounded-md px-2.5 py-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                            {venture.program}
                        </span>
                    )}
                    {venture.submittedAt && (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 font-medium">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            Application Submitted on {new Date(venture.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2.5 pt-4 border-t border-gray-100">
                    {venture.status === 'Rejected' ? (
                        <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-red-50 text-red-400 border border-red-200 cursor-not-allowed"
                            disabled
                            onClick={(e) => e.stopPropagation()}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Declined
                        </button>
                    ) : venture.status === 'Joined Program' ? (
                        <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/venture/${venture.id}/workbench`);
                            }}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Workbench
                        </button>
                    ) : venture.workbench_locked ? (
                        <button
                            className="flex-1 relative inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 transition-all shadow-lg shadow-brand-500/30 animate-pulse hover:animate-none"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/venture/${venture.id}/workbench`);
                            }}
                        >
                            <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-400 to-brand-500 opacity-0 hover:opacity-100 transition-opacity" />
                            <span className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-brand-400 via-amber-400 to-brand-500 opacity-30 blur-sm animate-pulse" />
                            <span className="relative flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                Review Plan
                            </span>
                        </button>
                    ) : venture.status === 'Contract Sent' ? (
                        <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/venture/${venture.id}/workbench`);
                            }}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Review Contract
                        </button>
                    ) : venture.agreement_status === 'Signed' ? (
                        <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/dashboard/venture/${venture.id}/workbench`);
                            }}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Workbench
                        </button>
                    ) : (
                        <button
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
                            disabled
                            onClick={(e) => e.stopPropagation()}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            Workbench Locked
                        </button>
                    )}
                    <button
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/venture/${venture.id}`);
                        }}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                    </button>
                </div>
            </div>
        </div>
    );
};
