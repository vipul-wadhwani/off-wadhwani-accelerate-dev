import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddNoteModalProps {
    onSave: (data: { note_text: string; action_items: string[] }) => Promise<void>;
    onClose: () => void;
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({ onSave, onClose }) => {
    const [noteText, setNoteText] = useState('');
    const [actionItemsText, setActionItemsText] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!noteText.trim()) return;
        setSaving(true);
        try {
            const action_items = actionItemsText
                .split('\n')
                .map((line) => line.replace(/^[-*]\s*/, '').trim())
                .filter(Boolean);
            await onSave({ note_text: noteText.trim(), action_items });
            onClose();
        } catch (err) {
            console.error('Error saving note:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Add Notes & Action Items</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-indigo-600 mb-1.5">Notes / Update</label>
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={4}
                            placeholder="What's the latest progress?"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm resize-y"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-indigo-600 mb-1.5">Action Items (One per line)</label>
                        <textarea
                            value={actionItemsText}
                            onChange={(e) => setActionItemsText(e.target.value)}
                            rows={3}
                            placeholder={"- Follow up with design team\n- Schedule review meeting"}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm resize-y"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !noteText.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Update'}
                    </button>
                </div>
            </div>
        </div>
    );
};
