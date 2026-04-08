import React, { useState, useEffect } from 'react';
import { AvailabilityGrid } from './AvailabilityGrid';
import { useAvailability } from '../hooks/useAvailability';
import type { AvailabilitySlot } from '../types';
import { useAuth } from '../../../context/AuthContext';
import { Loader2, Save, Check } from 'lucide-react';

export const ManageAvailabilityPage: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const { slots, loading, saving, saveSlots } = useAvailability(userId);
    const [localSlots, setLocalSlots] = useState<AvailabilitySlot[]>([]);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setLocalSlots(slots);
    }, [slots]);

    const handleSave = async () => {
        const success = await saveSlots(localSlots);
        if (success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Availability</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Click on time slots to mark when you're available for meetings
                </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-4 rounded bg-teal-500 border border-teal-600" />
                            <span>Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-4 rounded bg-gray-50 border border-gray-200" />
                            <span>Unavailable</span>
                        </div>
                    </div>
                </div>

                <AvailabilityGrid slots={localSlots} onChange={setLocalSlots} />

                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Availability'}
                    </button>
                    {saved && (
                        <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                            <Check className="w-4 h-4" /> Saved!
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
