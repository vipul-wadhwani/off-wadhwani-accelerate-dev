import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, Video, Calendar, Clock, Users } from 'lucide-react';

export const UpcomingMeetingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const role = user?.user_metadata?.role;
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                if (role === 'venture_mgr' || role === 'committee_member') {
                    const data = await api.getVPVMUpcomingSessions();
                    setSessions(data);
                } else {
                    const data = await api.getMyMentorSessions();
                    setSessions(data);
                }
            } catch (err) {
                console.error('Error fetching sessions:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [role]);

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
                <h1 className="text-2xl font-bold text-gray-900">My Meetings</h1>
                <p className="text-sm text-gray-500 mt-1">Your upcoming and scheduled sessions</p>
            </div>

            {sessions.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No upcoming meetings.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sessions.map((session: any) => {
                        const dateStr = session.scheduled_date
                            ? new Date(session.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                            : '-';
                        const timeStr = session.scheduled_time ? session.scheduled_time.slice(0, 5) : '-';

                        return (
                            <div key={session.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                                        <Video className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {session.topic || 'Session'}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                            {session.venture_name && (
                                                <span className="font-medium text-teal-700">{session.venture_name}</span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> {dateStr}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {timeStr}
                                            </span>
                                            {(session.expert_name || session.mentor_name) && (
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" /> {session.expert_name || session.mentor_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate(`/meeting/${session.id}`)}
                                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                                >
                                    <Video className="w-3.5 h-3.5" /> Join
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
