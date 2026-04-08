import React, { useState, useEffect } from 'react';
import { X, Calendar, Loader2, Clock, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';

interface Expert {
    id: string;
    full_name: string;
    email: string;
    expertise_areas: string[];
    bio: string;
}

interface ScheduleExpertSessionModalProps {
    ventureId: string;
    ventureName: string;
    founderName?: string;
    onClose: () => void;
    onScheduled: () => void;
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
    return `${day} ${month}`;
}

function toISODate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function formatTime(time: string): string {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
}

const TIME_SLOTS = [
    { label: '9:00 AM', value: '09:00' },
    { label: '10:00 AM', value: '10:00' },
    { label: '11:00 AM', value: '11:00' },
    { label: '12:00 PM', value: '12:00' },
    { label: '2:00 PM', value: '14:00' },
    { label: '3:00 PM', value: '15:00' },
    { label: '4:00 PM', value: '16:00' },
    { label: '5:00 PM', value: '17:00' },
];

export const ScheduleExpertSessionModal: React.FC<ScheduleExpertSessionModalProps> = ({
    ventureId,
    ventureName,
    founderName,
    onClose,
    onScheduled,
}) => {
    const [mentors, setMentors] = useState<Expert[]>([]);
    const [loadingMentors, setLoadingMentors] = useState(true);
    const [selectedMentorId, setSelectedMentorId] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [topic, setTopic] = useState('');
    const [duration, setDuration] = useState(60);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availableSlots, setAvailableSlots] = useState<typeof TIME_SLOTS | null>(null);
    const [loadingSlots, setLoadingSlots] = useState(false);

    const nextWeekdays = getNextWeekdays(10);
    const selectedExpert = mentors.find(m => m.id === selectedMentorId);

    // Fetch expert availability when expert + date change
    useEffect(() => {
        if (!selectedMentorId || !selectedDate) {
            setAvailableSlots(null);
            return;
        }
        let cancelled = false;
        const fetchSlots = async () => {
            setLoadingSlots(true);
            setSelectedTime('');
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                const { supabase } = await import('../lib/supabase');
                const token = (await supabase.auth.getSession()).data.session?.access_token;
                const res = await fetch(`${API_URL}/api/availability/${selectedMentorId}/slots?date=${selectedDate}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!cancelled) {
                    if (data.success && data.data && data.data.length > 0) {
                        setAvailableSlots(data.data.map((s: any) => ({
                            label: formatTime(s.start_time.slice(0, 5)),
                            value: s.start_time.slice(0, 5),
                        })));
                    } else {
                        // No availability set — fallback to all slots
                        setAvailableSlots(null);
                    }
                }
            } catch {
                if (!cancelled) setAvailableSlots(null);
            } finally {
                if (!cancelled) setLoadingSlots(false);
            }
        };
        fetchSlots();
        return () => { cancelled = true; };
    }, [selectedMentorId, selectedDate]);

    useEffect(() => {
        const fetchMentors = async () => {
            try {
                const data = await api.getVentureMentors(ventureId);
                setMentors(data);
                if (data.length === 1) setSelectedMentorId(data[0].id);
            } catch (err: any) {
                setError('Failed to load experts. Please try again.');
            } finally {
                setLoadingMentors(false);
            }
        };
        fetchMentors();
    }, [ventureId]);

    const handleConfirm = async () => {
        if (!selectedMentorId || !selectedDate || !selectedTime) return;

        setSubmitting(true);
        setError(null);

        try {
            await api.createMentorSession(ventureId, {
                mentor_id: selectedMentorId,
                topic: topic || undefined,
                scheduled_date: selectedDate,
                scheduled_time: selectedTime,
                duration_minutes: duration,
            });
            onScheduled();
        } catch (err: any) {
            setError(err.message || 'Failed to schedule session');
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = selectedMentorId && selectedDate && selectedTime && !submitting;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Schedule Expert Session</h2>
                        <span className="text-sm text-gray-600">
                            For <span className="font-semibold">{ventureName}</span>
                        </span>
                        {founderName && (
                            <div className="text-xs text-gray-500 mt-0.5">
                                Founder: <span className="font-semibold text-gray-700">{founderName}</span>
                            </div>
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
                    {/* Mentor Selection */}
                    {loadingMentors ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                            <span className="ml-2 text-sm text-gray-500">Loading experts...</span>
                        </div>
                    ) : mentors.length === 0 ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                            No experts assigned to this venture yet. Please assign an expert first.
                        </div>
                    ) : (
                        <>
                            {/* Step 1: Select Mentor */}
                            <div>
                                <div className="mb-3">
                                    <span className="text-sm font-medium text-gray-700">1. Select Expert</span>
                                </div>
                                <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                                    {mentors.length === 1 ? (
                                        <div>
                                            <div className="text-sm font-bold text-gray-900">{selectedExpert?.full_name}</div>
                                            <div className="text-xs text-gray-500">{selectedExpert?.email}</div>
                                            {selectedExpert?.expertise_areas && selectedExpert.expertise_areas.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {selectedExpert.expertise_areas.map((area, i) => (
                                                        <span key={i} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                                                            {area}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">Assigned Experts</div>
                                            <select
                                                value={selectedMentorId}
                                                onChange={(e) => setSelectedMentorId(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg text-sm text-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                            >
                                                <option value="">Choose an expert...</option>
                                                {mentors.map(m => (
                                                    <option key={m.id} value={m.id}>{m.full_name}</option>
                                                ))}
                                            </select>
                                            {selectedExpert?.expertise_areas && selectedExpert.expertise_areas.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {selectedExpert.expertise_areas.map((area, i) => (
                                                        <span key={i} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
                                                            {area}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Select Date */}
                            <div>
                                <div className="mb-3">
                                    <span className="text-sm font-medium text-gray-700">2. Select Date</span>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                    {nextWeekdays.map((date) => {
                                        const iso = toISODate(date);
                                        const isSelected = selectedDate === iso;
                                        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                        return (
                                            <button
                                                key={iso}
                                                onClick={() => setSelectedDate(iso)}
                                                className={`px-2 py-2 rounded-lg text-center border transition-colors ${
                                                    isSelected
                                                        ? 'bg-teal-600 text-white border-teal-600'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:bg-teal-50'
                                                }`}
                                            >
                                                <div className={`text-xs ${isSelected ? 'text-teal-100' : 'text-gray-500'}`}>{dayName}</div>
                                                <div className="text-sm font-semibold">{formatDateChip(date)}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step 3: Select Time */}
                            <div>
                                <div className="mb-3 flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">3. Select Time</span>
                                    {availableSlots && (
                                        <span className="text-xs text-teal-600 font-medium">Based on expert availability</span>
                                    )}
                                    {loadingSlots && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />}
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {(availableSlots || TIME_SLOTS).map((slot) => {
                                        const isSelected = selectedTime === slot.value;
                                        return (
                                            <button
                                                key={slot.value}
                                                onClick={() => setSelectedTime(slot.value)}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                                    isSelected
                                                        ? 'bg-teal-600 text-white border-teal-600'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:bg-teal-50'
                                                }`}
                                            >
                                                <Clock className={`w-3.5 h-3.5 mx-auto mb-1 ${isSelected ? 'text-teal-100' : 'text-gray-400'}`} />
                                                {slot.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Step 4: Topic & Duration */}
                            <div className="space-y-3">
                                <div>
                                    <div className="mb-2">
                                        <span className="text-sm font-medium text-gray-700">4. Topic / Goal (optional)</span>
                                    </div>
                                    <div className="relative">
                                        <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                        <input
                                            type="text"
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                            placeholder="e.g., GTM strategy review, Product roadmap..."
                                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-gray-600">Duration:</span>
                                    <select
                                        value={duration}
                                        onChange={(e) => setDuration(Number(e.target.value))}
                                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        <option value={30}>30 min</option>
                                        <option value={60}>60 min</option>
                                        <option value={90}>90 min</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!canSubmit}
                        className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {submitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Calendar className="w-4 h-4" />
                        )}
                        Schedule Session
                    </button>
                </div>
            </div>
        </div>
    );
};
