import React, { useState, useEffect } from 'react';
import { ChevronLeft, Pencil, Calendar, User, ListChecks, MessageSquare, Clock, Plus, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { Deliverable, DeliverableNote } from './constants';
import { getDeliverableStyle, HEALTH_CONFIG } from './constants';
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

    const statusConfig = getDeliverableStyle(deliverable);

    if (editing) {
        return (
            <div className="p-6">
                <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-indigo-600 font-medium hover:text-indigo-700 mb-4">
                    <ChevronLeft className="w-4 h-4" />
                    Back
                </button>
                <DeliverableEditForm deliverable={deliverable} onSave={handleSave} onCancel={() => setEditing(false)} />
            </div>
        );
    }

    return (
        <div>
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${statusConfig.dot}`} />
                    <h3 className="text-base font-semibold text-gray-900 truncate">{deliverable.title}</h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.badge}`}>
                        <Clock className="w-3 h-3" />
                        {statusConfig.label}
                    </span>
                    {deliverable.status === 'in_progress' && (
                        <select
                            value={deliverable.health || 'on_track'}
                            onChange={async (e) => {
                                try {
                                    await api.updateDeliverableStatus(ventureId, deliverable.id, undefined, e.target.value);
                                    onUpdate({ ...deliverable, health: e.target.value });
                                } catch (err: any) {
                                    alert(`Failed to update health: ${err.message || 'Unknown error'}`);
                                }
                            }}
                            className={`text-xs px-2 py-1 rounded-full border font-medium cursor-pointer ${(HEALTH_CONFIG[deliverable.health || 'on_track'] || HEALTH_CONFIG.on_track).badge}`}
                        >
                            {Object.entries(HEALTH_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.label}</option>
                            ))}
                        </select>
                    )}
                    <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                        <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="Close">
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
                {/* Description */}
                {deliverable.description && (
                    <p className="text-sm text-gray-600 leading-relaxed">{deliverable.description}</p>
                )}

                {/* Metadata bar */}
                <div className="flex items-center gap-5 px-4 py-3 bg-gray-50 rounded-xl text-sm">
                    <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-gray-500">Owner:</span>
                        <span className="font-medium text-gray-800">{deliverable.owner || '—'}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-gray-500">Start:</span>
                        <span className="font-medium text-gray-800">
                            {deliverable.start_date
                                ? new Date(deliverable.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                        </span>
                    </div>
                    <div className="w-px h-4 bg-gray-200" />
                    <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-gray-500">End:</span>
                        <span className="font-medium text-gray-800">
                            {deliverable.due_date
                                ? new Date(deliverable.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '—'}
                        </span>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                    {([
                        { label: 'Expert Connect', type: 'expert_connect' as RecommendationType },
                        { label: 'Service Provider', type: 'service_provider' as RecommendationType },
                        { label: 'Masterclass', type: 'masterclass' as RecommendationType },
                        { label: 'Research', type: 'research' as RecommendationType },
                    ]).map(({ label, type }) => (
                        <button
                            key={type}
                            disabled
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-400 border border-gray-200 rounded-lg cursor-not-allowed"
                        >
                            <Plus className="w-3 h-3" />
                            Add {label}
                        </button>
                    ))}
                </div>

                {/* Tabs */}
                <div className="border-t border-gray-100 pt-4">
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setActiveTab('checklist')}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                activeTab === 'checklist'
                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
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
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            <MessageSquare className="w-4 h-4" />
                            Notes ({notes.length})
                        </button>
                    </div>

                    {/* Tab content */}
                    {activeTab === 'checklist' && (
                        <div className="bg-gray-50 rounded-xl p-4">
                            {checklistCount.total > 0 ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">{checklistCount.completed} of {checklistCount.total} items completed</span>
                                    <button
                                        onClick={() => setShowChecklistModal(true)}
                                        className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                                    >
                                        View / Edit
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-2">
                                    <p className="text-sm text-gray-400 mb-2">No checklist items yet</p>
                                    <button
                                        onClick={() => setShowChecklistModal(true)}
                                        className="text-sm text-indigo-600 font-medium hover:text-indigo-700"
                                    >
                                        + Add Checklist Items
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-gray-500">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
                                <button
                                    onClick={() => setShowAddNoteModal(true)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                                >
                                    <Plus className="w-3 h-3" />
                                    Add Update
                                </button>
                            </div>

                            {loadingNotes ? (
                                <div className="text-sm text-gray-400 text-center py-4">Loading...</div>
                            ) : notes.length === 0 ? (
                                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-400 text-center">No notes yet.</div>
                            ) : (
                                <div className="space-y-3">
                                    {notes.map((note) => (
                                        <div key={note.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                                            <div className="text-xs font-medium text-indigo-600 mb-1.5">
                                                {new Date(note.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <p className="text-sm text-gray-700 mb-2">{note.note_text}</p>
                                            {note.action_items && note.action_items.length > 0 && (
                                                <>
                                                    <hr className="my-2 border-gray-200" />
                                                    <div className="text-xs font-semibold text-gray-700 mb-1">Action Items:</div>
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
