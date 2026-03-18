import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, User, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { VentureCard, type Venture } from '../components/VentureCard';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const MyVentures: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [ventures, setVentures] = useState<Venture[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchVentures();
        }
    }, [user]);

    const fetchVentures = async () => {
        try {
            setError(null);
            const { ventures: data } = await api.getVentures();

            // Transform data if needed to match Venture type,
            // but if table schema matches interface mostly, straightforward:
            const transformed: Venture[] = (data || []).map((v: any) => ({
                id: v.id,
                name: v.name,
                description: v.description,
                status: v.status,
                program: v.program,
                location: v.location,
                submittedAt: new Date(v.created_at).toISOString().split('T')[0],
                agreement_status: v.agreement_status,
                workbench_locked: v.workbench_locked,
            }));

            setVentures(transformed);
        } catch (err) {
            console.error('Error fetching ventures:', err);
            setError('Failed to load your ventures. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">My Ventures</h1>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                        Manage your applications and growth programs.
                        {user && (
                            <span className="text-xs bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-brand-700 font-medium">
                                <User className="w-3 h-3" />
                                {user.user_metadata?.full_name || user.email}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/new-application')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm shadow-brand-500/20"
                >
                    <Plus className="w-4 h-4" />
                    New Application
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
                </div>
            ) : error ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-red-200 shadow-sm min-h-[300px] flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
                    <p className="text-gray-500 max-w-sm">{error}</p>
                    <Button onClick={() => { setLoading(true); fetchVentures(); }} variant="outline" className="mt-4">
                        Retry
                    </Button>
                </div>
            ) : ventures.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm min-h-[400px] flex flex-col items-center justify-center space-y-4">
                    <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-brand-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">No Ventures Yet</h2>
                    <p className="text-gray-500 max-w-sm">
                        You haven't submitted any applications yet. Start your journey by applying for our growth programs.
                    </p>
                    <Button onClick={() => navigate('/dashboard/new-application')} variant="outline" className="mt-4">
                        Apply Now
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {ventures.map(venture => (
                        <VentureCard key={venture.id} venture={venture} />
                    ))}
                </div>
            )}
        </div>
    );
};
