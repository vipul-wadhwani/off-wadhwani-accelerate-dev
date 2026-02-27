import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const VentureDetails: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const [venture, setVenture] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [streams, setStreams] = useState<any[]>([]);

    useEffect(() => {
        if (id && user) {
            fetchVenture(id);
        }
    }, [id, user]);

    const fetchVenture = async (ventureId: string) => {
        try {
            // Fetch Venture Data and Streams in one call
            const { venture, streams } = await api.getVenture(ventureId);

            setVenture(venture);
            setStreams(streams || []);

        } catch (err) {
            console.error('Error fetching venture:', err);
            navigate('/dashboard'); // Redirect on error
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

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div>
                <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-gray-900 text-sm mb-4">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Ventures
                </button>

                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{venture.name}</h1>
                        <p className="text-gray-500 mt-1">Founder: {user?.user_metadata?.full_name}</p>
                    </div>

                    <div className="bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium border border-green-200 flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Selected: {venture.program}
                    </div>
                </div>
            </div>

            {/* Growth Trajectory */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Growth Trajectory</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Current */}
                    <div className="p-8 bg-gray-50/50 space-y-6">
                        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">From (Current)</span>

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Product</div>
                                <div className="font-medium text-gray-900">{venture.what_do_you_sell || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Segment</div>
                                <div className="font-medium text-gray-900">{venture.who_do_you_sell_to || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Geography</div>
                                <div className="font-medium text-gray-900">{venture.which_regions || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Revenue (Last 12 Months)</div>
                                <div className="font-medium text-gray-900">₹{venture.revenue_12m || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Full-Time Employees</div>
                                <div className="font-medium text-gray-900">{venture.full_time_employees || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">City, State</div>
                                <div className="font-medium text-gray-900">
                                    {venture.city ?
                                        `${venture.city}${venture.state ? `, ${venture.state}` : ''}` :
                                        'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Target */}
                    <div className="p-8 bg-blue-50/30 space-y-6 border-l border-gray-100">
                        <span className="text-sm font-semibold text-blue-600 uppercase tracking-wide">To (Target)</span>

                        <div className="space-y-4">
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">New Product</div>
                                <div className="font-medium text-gray-900">{venture.focus_product || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">New Segment</div>
                                <div className="font-medium text-gray-900">{venture.focus_segment || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">New Geography</div>
                                <div className="font-medium text-gray-900">{venture.focus_geography || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Revenue Potential (3 Years)</div>
                                <div className="font-medium text-gray-900">₹{venture.revenue_potential_3y || 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Incremental Hiring</div>
                                <div className="font-medium text-gray-900">{venture.incremental_hiring || venture.commitment?.incrementalHiring || 'N/A'} new hires</div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-400 uppercase">Growth Focus</div>
                                <div className="font-medium text-gray-900">{venture.growth_focus || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Founder & Business Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <h3 className="text-lg font-bold text-gray-900">Founder & Business Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Founder Name</div>
                        <div className="font-medium text-gray-900">{venture.founder_name || user?.user_metadata?.full_name || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Role in Business</div>
                        <div className="font-medium text-gray-900">{venture.founder_designation || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Business Type</div>
                        <div className="font-medium text-gray-900">{venture.company_type || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Referred By</div>
                        <div className="font-medium text-gray-900">{venture.referred_by || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Email</div>
                        <div className="font-medium text-gray-900">{venture.founder_email || user?.email || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Phone</div>
                        <div className="font-medium text-gray-900">{venture.founder_phone || 'N/A'}</div>
                    </div>
                </div>
            </div>

            {/* Financial & Investment Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <h3 className="text-lg font-bold text-gray-900">Financial & Investment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Last Year Revenue</div>
                        <div className="font-medium text-gray-900 text-lg">₹{venture.revenue_12m || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">3-Year Revenue Potential</div>
                        <div className="font-medium text-gray-900 text-lg">₹{venture.revenue_potential_3y || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Minimum Investment Needed</div>
                        <div className="font-medium text-gray-900 text-lg">₹{venture.min_investment || 'N/A'}</div>
                    </div>
                </div>
            </div>

            {/* Team & Growth */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <h3 className="text-lg font-bold text-gray-900">Team & Growth Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Current Full-Time Employees</div>
                        <div className="font-medium text-gray-900 text-lg">{venture.full_time_employees || 'N/A'}</div>
                    </div>
                    <div>
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Planned Incremental Hiring</div>
                        <div className="font-medium text-gray-900 text-lg">+{venture.incremental_hiring || 'N/A'} new hires</div>
                    </div>
                    <div className="col-span-2">
                        <div className="text-xs font-medium text-gray-400 uppercase mb-1">Growth Focus Areas</div>
                        <div className="font-medium text-gray-900">{venture.growth_focus || 'N/A'}</div>
                    </div>
                </div>
            </div>

            {/* Self Assessment Needs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                <h3 className="text-lg font-bold text-gray-900">Self-Assessment Needs</h3>
                <div className="space-y-3">
                    {streams.length > 0 ? (
                        streams.map((stream: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50/50">
                                <span className="font-medium text-gray-700">{stream.stream_name}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${stream.status === 'Done' ? 'bg-green-100 text-green-800' :
                                    stream.status === 'Work in Progress' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                    {stream.status}
                                </span>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 italic">No needs assessment found.</p>
                    )}
                </div>
            </div>

            {/* Blockers & Challenges */}
            {venture.blockers && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">Specific Blockers or Challenges</h3>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">{venture.blockers}</p>
                    </div>
                </div>
            )}

            {/* Support Request */}
            {venture.support_request && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
                    <h3 className="text-lg font-bold text-gray-900">Support Request</h3>
                    <p className="text-sm text-gray-500 mb-2">How can the foundation specifically help you?</p>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                        <p className="text-gray-700 leading-relaxed">{venture.support_request}</p>
                    </div>
                </div>
            )}

        </div>
    );
};
