import React, { useEffect, useState } from 'react';
import { useRequests } from '../hooks/useRequests';
import type { MeetingRequest } from '../types';
import { useNavigate } from 'react-router-dom';
import { Loader2, Calendar, Clock, Users, Video, Check, X as XIcon, MessageSquare } from 'lucide-react';

interface RequestListPageProps {
    role: 'expert' | 'venture';
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-green-50 text-green-700 border-green-200',
    declined: 'bg-red-50 text-red-600 border-red-200',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-gray-50 text-gray-600 border-gray-200',
    cancelled: 'bg-gray-50 text-gray-400 border-gray-200',
};

export const RequestListPage: React.FC<RequestListPageProps> = ({ role }) => {
    const navigate = useNavigate();
    const { requests, loading, submitting, fetchRequests, acceptRequest, declineRequest } = useRequests();
    const [filter, setFilter] = useState<string>('');

    useEffect(() => {
        fetchRequests({ role, status: filter || undefined });
    }, [fetchRequests, role, filter]);

    const handleAccept = async (id: string) => {
        await acceptRequest(id);
        fetchRequests({ role, status: filter || undefined });
    };

    const handleDecline = async (id: string) => {
        await declineRequest(id);
        fetchRequests({ role, status: filter || undefined });
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Meeting Requests</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {role === 'expert' ? 'Requests from ventures for your expertise' : 'Your requests to experts'}
                    </p>
                </div>
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                    <option value="completed">Completed</option>
                </select>
            </div>

            {requests.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No requests found.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map((req: MeetingRequest) => (
                        <div key={req.id} className="bg-white border border-gray-200 rounded-xl p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">
                                        {role === 'expert'
                                            ? req.venture?.name || 'Venture'
                                            : req.expert?.full_name || 'Expert'}
                                    </h3>
                                    {role === 'expert' && req.company_info?.founder && (
                                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                            <Users className="w-3 h-3" /> {req.company_info.founder}
                                        </div>
                                    )}
                                </div>
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[req.status] || ''}`}>
                                    {req.status}
                                </span>
                            </div>

                            {req.meeting_goal && (
                                <p className="text-sm text-gray-600 mb-3">
                                    <span className="font-medium">Goal:</span> {req.meeting_goal}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-gray-400 mb-3">
                                {req.preferred_date && (
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(req.preferred_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    </span>
                                )}
                                {req.preferred_time && (
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {req.preferred_time.slice(0, 5)}
                                    </span>
                                )}
                            </div>

                            {/* Expert actions for pending requests */}
                            {role === 'expert' && req.status === 'pending' && (
                                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => handleAccept(req.id)}
                                        disabled={submitting}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Accept
                                    </button>
                                    <button
                                        onClick={() => handleDecline(req.id)}
                                        disabled={submitting}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                    >
                                        <XIcon className="w-3.5 h-3.5" /> Decline
                                    </button>
                                </div>
                            )}

                            {/* Join button for accepted requests */}
                            {req.status === 'accepted' && req.session_id && (
                                <div className="pt-3 border-t border-gray-100">
                                    <button
                                        onClick={() => navigate(`/meeting/${req.session_id}`)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
                                    >
                                        <Video className="w-3.5 h-3.5" /> Join Meeting
                                    </button>
                                </div>
                            )}

                            {req.expert_response_note && (
                                <div className="mt-2 text-xs text-gray-500 italic">
                                    Expert note: {req.expert_response_note}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
