import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Loader2 } from 'lucide-react';
import type { Interaction } from '../../types/interactions';
import { api } from '../../lib/api';
import { InteractionCard } from './InteractionCard';
import { AddInteractionModal } from './AddInteractionModal';

interface InteractionsSectionProps {
    ventureId: string;
    onInteractionsLoaded?: (count: number) => void;
}

export const InteractionsSection: React.FC<InteractionsSectionProps> = ({ ventureId, onInteractionsLoaded }) => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [typeFilter, setTypeFilter] = useState<string>('all');

    useEffect(() => {
        fetchInteractions();
    }, [ventureId]);

    const fetchInteractions = async () => {
        try {
            setLoading(true);
            const response = await api.getInteractions(ventureId);
            const list = response.interactions || [];
            setInteractions(list);
            onInteractionsLoaded?.(list.length);
        } catch (error) {
            console.error('Error fetching interactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddInteraction = async (data: any) => {
        try {
            await api.createInteraction(ventureId, data);
            setShowAddModal(false);
            fetchInteractions(); // Refresh list
        } catch (error) {
            console.error('Error creating interaction:', error);
            throw error;
        }
    };

    const handleDeleteInteraction = async (id: string) => {
        if (!confirm('Are you sure you want to delete this interaction?')) return;

        try {
            await api.deleteInteraction(id);
            fetchInteractions(); // Refresh list
        } catch (error) {
            console.error('Error deleting interaction:', error);
        }
    };

    const filteredInteractions = typeFilter === 'all'
        ? interactions
        : interactions.filter(i => i.interaction_type === typeFilter);

    return (
        <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50/50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Interactions</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {filteredInteractions.length} {filteredInteractions.length === 1 ? 'interaction' : 'interactions'}
                                {interactions.length === 0 && (
                                    <span className="text-amber-600 ml-2">— Add interactions to generate panel insights</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm font-semibold shadow-md"
                    >
                        <Plus className="w-4 h-4" />
                        Add Interaction
                    </button>
                </div>

                {/* Filters */}
                {interactions.length > 0 && (
                    <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Filter:</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-100 focus:border-purple-300 outline-none"
                            >
                                <option value="all">All Types</option>
                                <option value="call">Calls</option>
                                <option value="meeting">Meetings</option>
                                <option value="email">Emails</option>
                                <option value="note">Notes</option>
                            </select>
                            <span className="text-xs text-gray-500 ml-auto">
                                Showing {filteredInteractions.length} of {interactions.length}
                            </span>
                        </div>
                    </div>
                )}

                {/* Interactions List */}
                <div className="max-h-[600px] overflow-y-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                        </div>
                    ) : filteredInteractions.length === 0 ? (
                        <div className="text-center py-12 px-6">
                            <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-8 h-8 text-purple-300" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                {typeFilter === 'all' ? 'No interactions yet' : `No ${typeFilter}s yet`}
                            </h4>
                            <p className="text-sm text-gray-500 mb-2 max-w-md mx-auto">
                                Start tracking your conversations with this venture by adding call transcripts, meeting notes, or other interactions.
                            </p>
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6 max-w-md mx-auto">
                                Add at least one interaction to generate Panel SCALE Scorecard insights.
                            </p>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors text-sm font-semibold"
                            >
                                <Plus className="w-4 h-4" />
                                Add First Interaction
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredInteractions.map((interaction) => (
                                <InteractionCard
                                    key={interaction.id}
                                    interaction={interaction}
                                    onDelete={() => handleDeleteInteraction(interaction.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Interaction Modal */}
            {showAddModal && (
                <AddInteractionModal
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddInteraction}
                />
            )}
        </>
    );
};
