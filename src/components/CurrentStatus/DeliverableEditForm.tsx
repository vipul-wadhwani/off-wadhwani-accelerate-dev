import React, { useState } from 'react';
import type { Deliverable } from './constants';

interface DeliverableEditFormProps {
    deliverable: Deliverable;
    onSave: (updates: Record<string, any>) => Promise<void>;
    onCancel: () => void;
}

export const DeliverableEditForm: React.FC<DeliverableEditFormProps> = ({ deliverable, onSave, onCancel }) => {
    const [form, setForm] = useState({
        title: deliverable.title || '',
        status: deliverable.status || 'pending',
        owner: deliverable.owner || '',
        start_date: deliverable.start_date || '',
        due_date: deliverable.due_date || '',
        description: deliverable.description || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(form);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm bg-white"
                    >
                        <option value="pending">Not Started</option>
                        <option value="in_progress">Work In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Owner</label>
                    <input
                        type="text"
                        value={form.owner}
                        onChange={(e) => setForm({ ...form, owner: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
                    <input
                        type="date"
                        value={form.start_date}
                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">End Date</label>
                    <input
                        type="date"
                        value={form.due_date}
                        onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm"
                    />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none text-sm resize-y"
                />
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};
