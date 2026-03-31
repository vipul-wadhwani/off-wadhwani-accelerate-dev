import React, { useState, useEffect } from 'react';
import { ChevronLeft, Pencil, Calendar, User, ListChecks, MessageSquare, Clock, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import type { Deliverable, DeliverableNote } from './constants';
import { DELIVERABLE_STATUS_CONFIG } from './constants';
import { DeliverableEditForm } from './DeliverableEditForm';
import { ChecklistModal } from './ChecklistModal';
import { AddNoteModal } from './AddNoteModal';
import { ResourceRecommendationModal } from './ResourceRecommendationModal';

type RecommendationType = 'expert_connect' | 'service_provider' | 'masterclass' | 'research';

interface DeliverableDetailProps {
    ventureId: string;
    deliverable: Deliverable;
    ventureName: string;
    onBack: () => void;
    onUpdate: (updated: Deliverable) => void;
}

export const DeliverableDetail: React.FC<DeliverableDetailProps> = ({ ventureId, deliverable, ventureName, onBack, onUpdate }) => {
    const [editing, setEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'checklist' | 'notes'>('checklist');
    const [showChecklistModal, setShowChecklistModal] = useState(false);
    const [showAddNoteModal, setShowAddNoteModal] = useState(false);
    const [recommendationType, setRecommendationType] = useState<RecommendationType | null>(null);
    const [checklistCount, setChecklistCount] = useState({ completed: 0, total: 0 });
    const [notes, setNotes] = useState<DeliverableNote[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);

    useEffect(() => {
        fetchChecklistCount();
        fetchNotes();
    }, [deliverable.id]);

    const fetchChecklistCount = async () => {
        try {
            const result = await api.getChecklistItems(ventureId, deliverable.id);
            const items = result?.items || [];
            setChecklistCount({
                completed: items.filter((i: any) => i.is_completed).length,
                total: items.length,
            });
        } catch (err) {
            console.error('Error fetching checklist count:', err);
        }
    };

    const fetchNotes = async () => {
        setLoadingNotes(true);
        try {
            const result = await api.getDeliverableNotes(ventureId, deliverable.id);
            setNotes(result?.notes || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleSave = async (updates: Record<string, any>) => {
        try {
            const result = await api.updateDeliverable(ventureId, deliverable.id, updates);
            if (result?.deliverable) {
                onUpdate(result.deliverable);
            }
            setEditing(false);
        } catch (err) {
            console.error('Error saving deliverable:', err);
        }
    };

    const handleAddNote = async (data: { note_text: string; action_items: string[] }) => {
        try {
            await api.addDeliverableNote(ventureId, deliverable.id, data);
            await fetchNotes();
        } catch (err) {
            console.error('Error adding note:', err);
        }
    };

    const statusConfig = DELIVERABLE_STATUS_CONFIG[deliverable.status] || DELIVERABLE_STATUS_CONFIG.pending;

    if (editing) {
        return (
            <div>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-700 mb-3">
                    <ChevronLeft className="w-4 h-4" />
                    Back to List
                </button>
                <DeliverableEditForm deliverable={deliverable} onSave={handleSave} onCancel={() => setEditing(false)} />
            </div>
        );
    }

    return (
        <div>
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-700 mb-3">
                <ChevronLeft className="w-4 h-4" />
                Back to List
            </button>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.dot}`} />
                        <h3 className="text-lg font-semibold text-gray-900">{deliverable.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.badge}`}>
                            <Clock className="w-3 h-3" />
                            {statusConfig.label}
                        </span>
                        <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Description */}
                {deliverable.description && (
                    <p className="text-sm text-gray-600 mb-5 leading-relaxed">{deliverable.description}</p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mb-5">
                    {([
                        { label: 'Expert Connect', type: 'expert_connect' as RecommendationType },
                        { label: 'Service Provider', type: 'service_provider' as RecommendationType },
                        { label: 'Masterclass', type: 'masterclass' as RecommendationType },
                        { label: 'Research', type: 'research' as RecommendationType },
                    ]).map(({ label, type }) => (
                        <button
                            key={type}
                            onClick={() => setRecommendationType(type)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add {label}
                        </button>
                    ))}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-6 px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-600 mb-5">
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-500">Start:</span>
                        {deliverable.start_date
                            ? new Date(deliverable.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-500">Owner:</span>
                        {deliverable.owner || '—'}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-500">End:</span>
                        {deliverable.due_date
                            ? new Date(deliverable.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setActiveTab('checklist')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            activeTab === 'checklist'
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <ListChecks className="w-4 h-4" />
                        Checklist ({checklistCount.completed}/{checklistCount.total})
                    </button>
                    <button
                        onClick={() => setActiveTab('notes')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            activeTab === 'notes'
                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        Notes and Action Items ({notes.length})
                    </button>
                </div>

                {/* Tab content */}
                {activeTab === 'checklist' && (
                    <div>
                        <button
                            onClick={() => setShowChecklistModal(true)}
                            className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                        >
                            {checklistCount.total > 0 ? 'View / Edit Checklist' : 'Add Checklist Items'}
                        </button>
                    </div>
                )}

                {activeTab === 'notes' && (
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-gray-900">Notes and Action Items</h4>
                            <button
                                onClick={() => setShowAddNoteModal(true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Update
                            </button>
                        </div>

                        {loadingNotes ? (
                            <div className="text-sm text-gray-400 text-center py-4">Loading...</div>
                        ) : notes.length === 0 ? (
                            <div className="text-sm text-gray-400 text-center py-4">No notes yet.</div>
                        ) : (
                            <div className="space-y-4">
                                {notes.map((note) => (
                                    <div key={note.id} className="border border-gray-200 rounded-xl p-4">
                                        <div className="text-sm font-medium text-indigo-600 mb-1">
                                            {new Date(note.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </div>
                                        <p className="text-sm text-gray-700 mb-2">{note.note_text}</p>
                                        {note.action_items && note.action_items.length > 0 && (
                                            <>
                                                <hr className="my-2 border-gray-100" />
                                                <div className="text-sm font-semibold text-gray-800 mb-1">Action Items:</div>
                                                <ul className="list-disc list-inside text-sm text-gray-600 space-y-0.5">
                                                    {note.action_items.map((item, idx) => (
                                                        <li key={idx}>{item}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showChecklistModal && (
                <ChecklistModal
                    ventureId={ventureId}
                    deliverable={deliverable}
                    onClose={() => setShowChecklistModal(false)}
                    onCountChange={setChecklistCount}
                />
            )}
            {showAddNoteModal && (
                <AddNoteModal
                    onSave={handleAddNote}
                    onClose={() => setShowAddNoteModal(false)}
                />
            )}
            {recommendationType && (
                <ResourceRecommendationModal
                    ventureId={ventureId}
                    deliverableId={deliverable.id}
                    deliverableTitle={deliverable.title}
                    ventureName={ventureName}
                    type={recommendationType}
                    onClose={() => setRecommendationType(null)}
                />
            )}
        </div>
    );
};
