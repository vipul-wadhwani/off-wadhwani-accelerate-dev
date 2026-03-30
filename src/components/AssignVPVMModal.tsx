import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface Venture {
    id: string;
    name: string;
    founder_name?: string;
    city?: string;
    program_recommendation?: string;
}

interface Candidate {
    id: string;
    full_name: string;
    role: string;
}

interface AssignVPVMModalProps {
    venture: Venture;
    onClose: () => void;
    onAssigned: () => void;
}

export const AssignVPVMModal: React.FC<AssignVPVMModalProps> = ({
    venture,
    onClose,
    onAssigned,
}) => {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchCandidates = async () => {
            try {
                const data = await api.getVPVMCandidates(venture.program_recommendation || '');
                setCandidates(data);
            } catch (err: any) {
                setError(err.message || 'Failed to load candidates');
            } finally {
                setLoading(false);
            }
        };
        fetchCandidates();
    }, [venture.program_recommendation]);

    const handleAssign = async () => {
        if (!selectedId) return;
        setSubmitting(true);
        setError('');
        try {
            await api.assignVPVM(venture.id, selectedId);
            onAssigned();
        } catch (err: any) {
            setError(err.message || 'Failed to assign VP/VM');
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Assign VP/VM</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <p className="text-xs text-gray-400 mb-0.5">Applicant Name</p>
                        <p className="text-sm font-semibold text-gray-900">{venture.founder_name || '-'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-0.5">Business Name</p>
                        <p className="text-sm font-semibold text-gray-900">{venture.name}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-0.5">City</p>
                        <p className="text-sm font-semibold text-gray-900">{venture.city || '-'}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 mb-0.5">Program</p>
                        <p className="text-sm font-semibold text-gray-900">
                            {(venture.program_recommendation || '').toLowerCase().includes('prime') ? 'Prime' : 'Core/Select'}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-gray-400 mb-1.5">Select VP/VM</p>
                        {loading ? (
                            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading candidates...
                            </div>
                        ) : (
                            <select
                                value={selectedId}
                                onChange={(e) => setSelectedId(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                            >
                                <option value="">-- Select --</option>
                                {candidates.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.full_name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleAssign}
                        disabled={!selectedId || submitting}
                        className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Assigning...
                            </>
                        ) : (
                            'Assign'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
