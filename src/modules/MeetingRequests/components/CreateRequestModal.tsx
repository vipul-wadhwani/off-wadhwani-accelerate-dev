import React, { useState } from 'react';
import { X, Send, Loader2, MessageSquare, Calendar, Clock } from 'lucide-react';

interface CreateRequestModalProps {
    expertId: string;
    expertName: string;
    ventureId: string;
    ventureName?: string;
    defaultGoal?: string;
    onClose: () => void;
    onSubmit: (data: {
        venture_id: string;
        expert_id: string;
        meeting_goal?: string;
        preferred_date?: string;
        preferred_time?: string;
    }) => Promise<boolean>;
}

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
    expertId, expertName, ventureId, ventureName, defaultGoal, onClose, onSubmit,
}) => {
    const [goal, setGoal] = useState(defaultGoal || '');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        const success = await onSubmit({
            venture_id: ventureId,
            expert_id: expertId,
            meeting_goal: goal || undefined,
            preferred_date: date || undefined,
            preferred_time: time || undefined,
        });
        setSubmitting(false);
        if (success) {
            onClose();
        } else {
            setError('Failed to send request. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Send Meeting Request</h2>
                        <p className="text-sm text-gray-500">To {expertName}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {ventureName && (
                        <div className="text-sm text-gray-600">
                            For <span className="font-semibold text-gray-900">{ventureName}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Goal</label>
                        <div className="relative">
                            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <textarea
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                placeholder="What do you want to achieve from this meeting?"
                                rows={3}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Calendar className="w-3.5 h-3.5 inline mr-1" /> Preferred Date
                            </label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                <Clock className="w-3.5 h-3.5 inline mr-1" /> Preferred Time
                            </label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Send Request
                    </button>
                </div>
            </div>
        </div>
    );
};
