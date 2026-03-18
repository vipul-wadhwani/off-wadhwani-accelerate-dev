import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2, Link2 } from 'lucide-react';
import { api } from '../lib/api';

interface Venture {
    id: string;
    name: string;
    founder_name?: string;
    program_recommendation?: string;
}

interface Panelist {
    id: string;
    name: string;
    email: string;
    program: string;
}

interface ScheduleCallModalProps {
    venture: Venture;
    panelists: Panelist[];
    onClose: () => void;
    onScheduled: () => void;
}

interface BookedSlot {
    start_time: string;
    end_time: string;
}

function getNextWeekdays(count: number): Date[] {
    const dates: Date[] = [];
    const today = new Date();
    let current = new Date(today);

    while (dates.length < count) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
            dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function formatDateChip(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
}

function toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
}

const DEFAULT_TIME_SLOTS = [
    { startLabel: '9:00 AM', label: '9:00 AM - 10:00 AM', start: '09:00', end: '10:00' },
    { startLabel: '10:00 AM', label: '10:00 AM - 11:00 AM', start: '10:00', end: '11:00' },
    { startLabel: '11:00 AM', label: '11:00 AM - 12:00 PM', start: '11:00', end: '12:00' },
];

function formatSlotTime(time: string): string {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

function toSlotObject(slot: { start_time: string; end_time: string }) {
    const start = slot.start_time.slice(0, 5);
    const end = slot.end_time.slice(0, 5);
    return {
        startLabel: formatSlotTime(start),
        label: `${formatSlotTime(start)} - ${formatSlotTime(end)}`,
        start,
        end,
    };
}

function isSlotBooked(slot: { start: string; end: string }, bookedSlots: BookedSlot[]): boolean {
    return bookedSlots.some(booked => {
        const bStart = booked.start_time.slice(0, 5);
        const bEnd = booked.end_time.slice(0, 5);
        return slot.start < bEnd && slot.end > bStart;
    });
}

export const ScheduleCallModal: React.FC<ScheduleCallModalProps> = ({
    venture,
    panelists,
    onClose,
    onScheduled,
}) => {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [selectedPanelistId, setSelectedPanelistId] = useState<string>(panelists[0]?.id || '');
    const [meetLink, setMeetLink] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const [availableSlots, setAvailableSlots] = useState<typeof DEFAULT_TIME_SLOTS | null>(null);
    const [noSlotsMessage, setNoSlotsMessage] = useState<string | null>(null);

    const nextWeekdays = getNextWeekdays(7);
    const selectedPanelist = panelists.find(p => p.id === selectedPanelistId);

    // Fetch availability when date or panelist changes
    useEffect(() => {
        if (!selectedDate || !selectedPanelistId) {
            setBookedSlots([]);
            setAvailableSlots(null);
            setNoSlotsMessage(null);
            return;
        }

        let cancelled = false;
        const fetchAvailability = async () => {
            setLoadingAvailability(true);
            setNoSlotsMessage(null);
            try {
                // Fetch panelist preference-based slots
                const prefSlots = await api.getPanelistAvailableSlots(selectedPanelistId, selectedDate);

                if (!cancelled) {
                    if (prefSlots === null) {
                        // No preferences set — fallback to default slots
                        setAvailableSlots(DEFAULT_TIME_SLOTS);
                    } else if (prefSlots.length === 0) {
                        setAvailableSlots([]);
                        setNoSlotsMessage('No available slots on this date');
                    } else {
                        setAvailableSlots(prefSlots.map(toSlotObject));
                    }
                }

                // Also fetch booked calls for overlap detection on fallback slots
                const data = await api.getPanelistAvailability(selectedPanelistId, selectedDate);
                if (!cancelled) {
                    setBookedSlots(
                        (data.calls || []).map((c: any) => ({
                            start_time: c.start_time,
                            end_time: c.end_time,
                        }))
                    );
                }
            } catch {
                if (!cancelled) {
                    setBookedSlots([]);
                    setAvailableSlots(DEFAULT_TIME_SLOTS);
                }
            } finally {
                if (!cancelled) setLoadingAvailability(false);
            }
        };

        fetchAvailability();
        return () => { cancelled = true; };
    }, [selectedDate, selectedPanelistId]);

    // Reset slot selection when date changes
    useEffect(() => {
        setSelectedSlot(null);
    }, [selectedDate]);

    const handleConfirm = async () => {
        if (!selectedDate || selectedSlot === null || !selectedPanelistId) return;

        setSubmitting(true);
        setError(null);

        try {
            const slotsToUse = availableSlots || DEFAULT_TIME_SLOTS;
            const slot = slotsToUse[selectedSlot];
            await api.createScheduledCall({
                venture_id: venture.id,
                panelist_id: selectedPanelistId,
                call_date: selectedDate,
                start_time: slot.start,
                end_time: slot.end,
                meet_link: meetLink || undefined,
            });
            onScheduled();
        } catch (err: any) {
            setError(err.message || 'Failed to schedule call');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Schedule Panelist Call</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600">For <span className="font-semibold">{venture.name}</span></span>
                            {venture.program_recommendation && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    (venture.program_recommendation || '').toLowerCase().includes('prime')
                                        ? 'bg-purple-50 text-purple-700'
                                        : 'bg-blue-50 text-blue-700'
                                }`}>
                                    {(venture.program_recommendation || '').toLowerCase().includes('prime') ? 'Prime' : 'Core/Select'}
                                </span>
                            )}
                        </div>
                        {venture.founder_name && (
                            <div className="text-xs text-gray-500 mt-1">Name: <span className="font-semibold text-gray-700">{venture.founder_name}</span></div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Assigned Panelist Box */}
                    {panelists.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Assigned Panelist</div>
                            {panelists.length === 1 ? (
                                <div>
                                    <div className="text-sm font-bold text-gray-900">{selectedPanelist?.name}</div>
                                    <div className="text-xs text-gray-500">Program: Panel ({selectedPanelist?.program})</div>
                                </div>
                            ) : (
                                <>
                                    <select
                                        value={selectedPanelistId}
                                        onChange={(e) => setSelectedPanelistId(e.target.value)}
                                        className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {panelists.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    {selectedPanelist && (
                                        <div className="text-xs text-gray-500 mt-1">Program: Panel ({selectedPanelist.program})</div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Step 1: Select Date */}
                    <div>
                        <div className="mb-3">
                            <span className="text-sm font-medium text-gray-700">1. Select Date</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {nextWeekdays.map((date) => {
                                const iso = toISODate(date);
                                const isSelected = selectedDate === iso;
                                return (
                                    <button
                                        key={iso}
                                        onClick={() => setSelectedDate(iso)}
                                        className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                                        }`}
                                    >
                                        {formatDateChip(date)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Step 2: Select Time Slot */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">2. Select Time Slot</span>
                            </div>
                        </div>
                        {loadingAvailability ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                                <span className="ml-2 text-sm text-gray-500">Checking availability...</span>
                            </div>
                        ) : noSlotsMessage ? (
                            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 text-center">
                                {noSlotsMessage}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {(availableSlots || DEFAULT_TIME_SLOTS).map((slot, index) => {
                                    const booked = isSlotBooked(slot, bookedSlots);
                                    const isSelected = selectedSlot === index;
                                    return (
                                        <button
                                            key={index}
                                            onClick={() => !booked && setSelectedSlot(index)}
                                            disabled={booked}
                                            className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                                                booked
                                                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed'
                                                    : isSelected
                                                        ? 'bg-indigo-600 border-indigo-600'
                                                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className={`text-xs ${booked ? 'text-gray-400' : isSelected ? 'text-indigo-200' : 'text-gray-500'}`}>
                                                        {slot.startLabel}
                                                    </div>
                                                    <div className={`text-sm font-semibold ${booked ? 'text-gray-400' : isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                        {slot.label}
                                                    </div>
                                                </div>
                                                {booked && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-gray-400 bg-gray-100 uppercase tracking-wide">
                                                        Booked
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Step 3: Meeting Link */}
                    <div>
                        <div className="mb-3">
                            <span className="text-sm font-medium text-gray-700">3. Meeting Link (Zoom/Teams)</span>
                        </div>
                        <div className="relative">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="url"
                                value={meetLink}
                                onChange={(e) => setMeetLink(e.target.value)}
                                placeholder="https://zoom.us/j/..."
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedDate || selectedSlot === null || !selectedPanelistId || submitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Calendar className="w-4 h-4" />
                        )}
                        Confirm Schedule
                    </button>
                </div>
            </div>
        </div>
    );
};
