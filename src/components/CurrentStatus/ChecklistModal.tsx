import React, { useState, useEffect } from 'react';
import { X, ListChecks, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import type { Deliverable, ChecklistItem } from './constants';

interface ChecklistModalProps {
    ventureId: string;
    deliverable: Deliverable;
    onClose: () => void;
    onCountChange: (count: { completed: number; total: number }) => void;
}

export const ChecklistModal: React.FC<ChecklistModalProps> = ({ ventureId, deliverable, onClose, onCountChange }) => {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [newItemText, setNewItemText] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const result = await api.getChecklistItems(ventureId, deliverable.id);
            const fetched = result?.items || [];
            setItems(fetched);
            updateCount(fetched);
        } catch (err) {
            console.error('Error fetching checklist:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateCount = (list: ChecklistItem[]) => {
        onCountChange({
            completed: list.filter((i) => i.is_completed).length,
            total: list.length,
        });
    };

    const handleToggle = async (item: ChecklistItem) => {
        const updated = items.map((i) => (i.id === item.id ? { ...i, is_completed: !i.is_completed } : i));
        setItems(updated);
        updateCount(updated);
        try {
            await api.updateChecklistItem(ventureId, deliverable.id, item.id, { is_completed: !item.is_completed });
        } catch (err) {
            console.error('Error toggling checklist item:', err);
            setItems(items);
            updateCount(items);
        }
    };

    const handleAdd = async () => {
        if (!newItemText.trim()) return;
        try {
            const result = await api.addChecklistItem(ventureId, deliverable.id, newItemText.trim());
            if (result?.item) {
                const updated = [...items, result.item];
                setItems(updated);
                updateCount(updated);
                setNewItemText('');
            }
        } catch (err) {
            console.error('Error adding checklist item:', err);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <ListChecks className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Checklist</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 overflow-y-auto flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{deliverable.title}</h3>
                    <p className="text-sm text-gray-500 mb-5">{deliverable.description}</p>

                    {loading ? (
                        <div className="text-sm text-gray-400 text-center py-4">Loading...</div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 cursor-pointer"
                                    onClick={() => handleToggle(item)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={item.is_completed}
                                        onChange={() => handleToggle(item)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={`text-sm ${item.is_completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                        {item.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-4">
                        <input
                            type="text"
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                            placeholder="Add a new item..."
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!newItemText.trim()}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
                        >
                            <Plus className="w-4 h-4" />
                            Add Item
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
