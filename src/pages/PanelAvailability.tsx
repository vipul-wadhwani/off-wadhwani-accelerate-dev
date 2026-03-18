import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Trash2, Loader2, CalendarOff } from 'lucide-react';
import { api } from '../lib/api';

const DAYS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 7; // 7 AM to 7 PM
    const label = hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`;
    const value = `${String(hour).padStart(2, '0')}:00`;
    return { label, value };
});

interface Slot {
    start_time: string;
    end_time: string;
}

interface DaySchedule {
    enabled: boolean;
    slots: Slot[];
}

type WeekSchedule = Record<number, DaySchedule>;

function computeEndTime(startTime: string): string {
    const hour = parseInt(startTime.split(':')[0], 10) + 1;
    return `${String(hour).padStart(2, '0')}:00`;
}

function formatTime(time: string): string {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

function initWeekSchedule(): WeekSchedule {
    const schedule: WeekSchedule = {};
    DAYS.forEach(d => {
        schedule[d.value] = { enabled: false, slots: [] };
    });
    return schedule;
}

export const PanelAvailability: React.FC = () => {
    const [panelistId, setPanelistId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [schedule, setSchedule] = useState<WeekSchedule>(initWeekSchedule());
    const [blockedDates, setBlockedDates] = useState<{ id: string; blocked_date: string }[]>([]);
    const [blockDateInput, setBlockDateInput] = useState('');
    const [addingBlock, setAddingBlock] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const profile = await api.getMyPanelistProfile();
            if (!profile) {
                setError('No panelist profile found for your account.');
                setLoading(false);
                return;
            }
            setPanelistId(profile.id);

            const [slots, blocked] = await Promise.all([
                api.getPanelistWeeklyAvailability(profile.id),
                api.getPanelistBlockedDates(profile.id),
            ]);

            // Build schedule from DB slots
            const newSchedule = initWeekSchedule();
            slots.forEach((slot: any) => {
                const day = slot.day_of_week as number;
                if (newSchedule[day]) {
                    newSchedule[day].enabled = true;
                    newSchedule[day].slots.push({
                        start_time: slot.start_time.slice(0, 5),
                        end_time: slot.end_time.slice(0, 5),
                    });
                }
            });
            setSchedule(newSchedule);
            setBlockedDates(blocked.map((b: any) => ({ id: b.id, blocked_date: b.blocked_date })));
        } catch (err: any) {
            setError(err.message || 'Failed to load availability data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const toggleDay = (day: number) => {
        setSchedule(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                enabled: !prev[day].enabled,
                slots: !prev[day].enabled ? prev[day].slots : [],
            },
        }));
    };

    const addSlot = (day: number) => {
        setSchedule(prev => {
            const existing = prev[day].slots;
            // Pick next available hour that doesn't conflict
            let startHour = 9;
            const usedHours = new Set(existing.map(s => parseInt(s.start_time.split(':')[0], 10)));
            while (usedHours.has(startHour) && startHour < 19) startHour++;
            if (startHour >= 19) return prev; // No more slots available

            const start_time = `${String(startHour).padStart(2, '0')}:00`;
            const end_time = computeEndTime(start_time);
            return {
                ...prev,
                [day]: {
                    ...prev[day],
                    slots: [...existing, { start_time, end_time }].sort((a, b) => a.start_time.localeCompare(b.start_time)),
                },
            };
        });
    };

    const removeSlot = (day: number, index: number) => {
        setSchedule(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                slots: prev[day].slots.filter((_, i) => i !== index),
            },
        }));
    };

    const updateSlotStartTime = (day: number, index: number, newStart: string) => {
        setSchedule(prev => {
            const slots = [...prev[day].slots];
            slots[index] = { start_time: newStart, end_time: computeEndTime(newStart) };
            return {
                ...prev,
                [day]: { ...prev[day], slots: slots.sort((a, b) => a.start_time.localeCompare(b.start_time)) },
            };
        });
    };

    const handleSave = async () => {
        if (!panelistId) return;
        setSaving(true);
        setSaveMessage(null);
        try {
            const flatSlots: { day_of_week: number; start_time: string; end_time: string }[] = [];
            DAYS.forEach(d => {
                const day = schedule[d.value];
                if (day.enabled) {
                    day.slots.forEach(slot => {
                        flatSlots.push({
                            day_of_week: d.value,
                            start_time: slot.start_time,
                            end_time: slot.end_time,
                        });
                    });
                }
            });
            await api.savePanelistWeeklyAvailability(panelistId, flatSlots);
            setSaveMessage('Availability saved successfully!');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (err: any) {
            setSaveMessage('Failed to save: ' + (err.message || 'Unknown error'));
        } finally {
            setSaving(false);
        }
    };

    const handleBlockDate = async () => {
        if (!panelistId || !blockDateInput) return;
        setAddingBlock(true);
        try {
            const result = await api.addPanelistBlockedDate(panelistId, blockDateInput);
            setBlockedDates(prev => [...prev, { id: result.id, blocked_date: result.blocked_date }].sort((a, b) => a.blocked_date.localeCompare(b.blocked_date)));
            setBlockDateInput('');
        } catch (err: any) {
            setSaveMessage('Failed to block date: ' + (err.message || 'Unknown error'));
        } finally {
            setAddingBlock(false);
        }
    };

    const handleRemoveBlockedDate = async (id: string) => {
        try {
            await api.removePanelistBlockedDate(id);
            setBlockedDates(prev => prev.filter(b => b.id !== id));
        } catch (err: any) {
            setSaveMessage('Failed to remove blocked date: ' + (err.message || 'Unknown error'));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                <span className="ml-3 text-gray-500">Loading availability settings...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto py-12">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <Clock className="w-7 h-7 text-red-600" />
                    <h1 className="text-2xl font-bold text-gray-900">Availability Settings</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Changes
                </button>
            </div>

            {saveMessage && (
                <div className={`mb-6 p-3 rounded-lg text-sm ${saveMessage.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {saveMessage}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column — Weekly Schedule */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Weekly Schedule</h2>
                        <p className="text-sm text-gray-500 mb-6">Set your available 1-hour slots for each day. The ops team will see these when scheduling calls.</p>

                        <div className="space-y-4">
                            {DAYS.map(day => {
                                const daySchedule = schedule[day.value];
                                return (
                                    <div key={day.value} className="border border-gray-100 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={daySchedule.enabled}
                                                    onChange={() => toggleDay(day.value)}
                                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                                />
                                                <span className={`font-medium ${daySchedule.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                                                    {day.label}
                                                </span>
                                            </label>
                                            {!daySchedule.enabled && (
                                                <span className="text-xs text-gray-400 italic">Unavailable</span>
                                            )}
                                        </div>

                                        {daySchedule.enabled && (
                                            <div className="mt-3 ml-7 space-y-2">
                                                {daySchedule.slots.map((slot, idx) => (
                                                    <div key={idx} className="flex items-center gap-3">
                                                        <select
                                                            value={slot.start_time}
                                                            onChange={e => updateSlotStartTime(day.value, idx, e.target.value)}
                                                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                                        >
                                                            {HOUR_OPTIONS.map(opt => (
                                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                            ))}
                                                        </select>
                                                        <span className="text-sm text-gray-500">to</span>
                                                        <span className="text-sm font-medium text-gray-700 w-20">
                                                            {formatTime(slot.end_time)}
                                                        </span>
                                                        <button
                                                            onClick={() => removeSlot(day.value, idx)}
                                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => addSlot(day.value)}
                                                    className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 font-medium mt-1"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Add 1-Hour Slot
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column — Blocked Dates */}
                <div>
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Blocked Dates</h2>
                        <p className="text-sm text-gray-500 mb-4">Block specific dates when you're unavailable regardless of your weekly schedule.</p>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="date"
                                value={blockDateInput}
                                onChange={e => setBlockDateInput(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                            <button
                                onClick={handleBlockDate}
                                disabled={!blockDateInput || addingBlock}
                                className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                            >
                                {addingBlock ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Block'}
                            </button>
                        </div>

                        {blockedDates.length === 0 ? (
                            <div className="flex flex-col items-center py-6 text-gray-400">
                                <CalendarOff className="w-8 h-8 mb-2" />
                                <span className="text-sm">No dates blocked</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {blockedDates.map(bd => (
                                    <div key={bd.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                                        <span className="text-sm text-gray-700">
                                            {new Date(bd.blocked_date + 'T00:00:00').toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </span>
                                        <button
                                            onClick={() => handleRemoveBlockedDate(bd.id)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
