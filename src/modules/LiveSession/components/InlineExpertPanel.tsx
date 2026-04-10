import React, { useEffect, useState } from 'react';
import { Loader2, Send, MapPin, ChevronDown } from 'lucide-react';
import { useExpertMatch } from '../../ExpertMatching/hooks/useExpertMatch';
import { useRequests } from '../../MeetingRequests/hooks/useRequests';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface InlineExpertPanelProps {
    ventureId: string;
    ventureName?: string;
}

async function getToken() {
    const { supabase } = await import('../../../lib/supabase');
    return (await supabase.auth.getSession()).data.session?.access_token || '';
}

export const InlineExpertPanel: React.FC<InlineExpertPanelProps> = ({ ventureId, ventureName }) => {
    const { matches, allExperts, loading, findMatches, searchExperts } = useExpertMatch();
    const { createRequest, submitting } = useRequests();
    const [hasFetched, setHasFetched] = useState(false);
    const [requestSent, setRequestSent] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!hasFetched && ventureId) {
            searchExperts();
            findMatches(ventureId, 5);
            setHasFetched(true);
        }
    }, [ventureId, hasFetched, findMatches, searchExperts]);

    const displayExperts = matches.length > 0
        ? matches
        : allExperts.slice(0, 5).map(e => ({ ...e, expert_id: e.id, score: null, rationale: null }));

    if (loading && displayExperts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs text-gray-500">Finding best experts for {ventureName || 'this venture'}...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {loading && matches.length === 0 && displayExperts.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg text-[10px] text-indigo-600 font-medium">
                    <Loader2 className="w-3 h-3 animate-spin" /> AI ranking experts...
                </div>
            )}

            {displayExperts.map((expert: any, index: number) => (
                <ExpertCard
                    key={expert.expert_id || expert.id}
                    expert={expert}
                    rank={index + 1}
                    ventureId={ventureId}
                    isSent={!!requestSent[expert.expert_id || expert.id]}
                    onRequestSent={() => setRequestSent(prev => ({ ...prev, [expert.expert_id || expert.id]: true }))}
                    createRequest={createRequest}
                    submitting={submitting}
                />
            ))}
        </div>
    );
};

/* ---- Expert Card ---- */

const ExpertCard: React.FC<{
    expert: any;
    rank: number;
    ventureId: string;
    isSent: boolean;
    onRequestSent: () => void;
    createRequest: any;
    submitting: boolean;
}> = ({ expert, rank, ventureId, isSent, onRequestSent, createRequest, submitting }) => {
    const [slots, setSlots] = useState<any[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [meetingGoal, setMeetingGoal] = useState('');
    const [showGoalInput, setShowGoalInput] = useState(false);
    const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

    const expertId = expert.expert_id || expert.id;
    const initials = expert.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    const industry = expert.industry_sectors?.[0] || null;

    const getNext7Days = () => {
        const days: { date: string; label: string }[] = [];
        const today = new Date();
        for (let i = 0; i <= 6; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            days.push({
                date: d.toISOString().split('T')[0],
                label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
            });
        }
        return days;
    };

    // Auto-load availability for tomorrow on mount
    useEffect(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const date = tomorrow.toISOString().split('T')[0];
        setSelectedDate(date);
        fetchSlots(date);
    }, [expertId]);

    const fetchSlots = async (date: string) => {
        setLoadingSlots(true);
        setSlots([]);
        setSelectedSlot(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/api/availability/${expertId}/slots?date=${date}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            setSlots(data.data || data.slots || data || []);
        } catch { setSlots([]); }
        finally { setLoadingSlots(false); }
    };

    const handleDateSelect = (date: string) => {
        setSelectedDate(date);
        setDateDropdownOpen(false);
        fetchSlots(date);
    };

    const handleBook = async () => {
        if (!selectedSlot || !meetingGoal.trim()) return;
        const success = await createRequest({
            venture_id: ventureId,
            expert_id: expertId,
            meeting_goal: meetingGoal,
            preferred_date: selectedDate,
            preferred_time: selectedSlot.start_time || selectedSlot.start,
            preferred_duration: 60,
        });
        if (success) {
            onRequestSent();
            setShowGoalInput(false);
            setMeetingGoal('');
        }
    };

    const selectedDateLabel = selectedDate
        ? new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
        : 'Select date';

    return (
        <div className="border border-gray-200 rounded-xl bg-white">
            {/* Header: Industry + Rank */}
            <div className="flex items-center justify-between px-4 pt-3">
                {industry && (
                    <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                        {industry}
                    </span>
                )}
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 w-5 h-5 rounded-full flex items-center justify-center">
                    #{rank}
                </span>
            </div>

            {/* Expert Info */}
            <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{expert.full_name}</p>
                    <p className="text-[11px] text-gray-500">{expert.company} · {expert.designation}</p>
                    <p className="text-[11px] text-gray-500">{expert.expertise_areas?.slice(0, 3).join(' · ')}</p>
                    {expert.city && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-2.5 h-2.5" /> {expert.city}
                        </p>
                    )}
                    {expert.years_experience && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{expert.years_experience} yrs experience</p>
                    )}
                </div>
            </div>

            {/* AI Rationale / Bio */}
            {(expert.rationale || expert.bio) && (
                <div className="mx-4 mb-3 pl-3 border-l-2 border-indigo-400 bg-indigo-50/50 rounded-r-lg py-2 pr-3">
                    <p className="text-[11px] text-gray-700 leading-relaxed">{expert.rationale || expert.bio}</p>
                </div>
            )}

            {/* Date Selector */}
            <div className="px-4 mb-3">
                <div className="relative">
                    <button
                        onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700 hover:border-gray-300"
                    >
                        <span>{selectedDate ? `${selectedDateLabel} · ${slots.length} slots` : 'Select a date to see availability'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dateDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 max-h-48 overflow-y-auto">
                            {getNext7Days().map(({ date, label }) => (
                                <button
                                    key={date}
                                    onClick={() => handleDateSelect(date)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 ${selectedDate === date ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
                <div className="px-4 mb-3">
                    {loadingSlots ? (
                        <div className="flex items-center gap-2 py-2">
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                            <span className="text-[10px] text-gray-400">Loading slots...</span>
                        </div>
                    ) : slots.length === 0 ? (
                        <p className="text-[10px] text-gray-400 py-2">No available slots on this date</p>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {slots.map((slot: any, i: number) => {
                                const start = (slot.start_time || slot.start || '').slice(0, 5);
                                const end = (slot.end_time || slot.end || '').slice(0, 5);
                                const isActive = selectedSlot === slot;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => { setSelectedSlot(slot); setShowGoalInput(true); }}
                                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                                            isActive
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                                        }`}
                                    >
                                        {start}-{end}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Book Meeting */}
            {showGoalInput && selectedSlot && !isSent && (
                <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
                    <textarea
                        value={meetingGoal}
                        onChange={e => setMeetingGoal(e.target.value)}
                        placeholder="What would you like to discuss?"
                        rows={2}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <button
                        onClick={handleBook}
                        disabled={submitting || !meetingGoal.trim()}
                        className="w-full py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                        {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        {submitting ? 'Sending...' : 'Send Meeting Request'}
                    </button>
                </div>
            )}

            {/* Sent confirmation */}
            {isSent && (
                <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 font-medium">
                        ✓ Meeting request sent!
                    </div>
                </div>
            )}
        </div>
    );
};
