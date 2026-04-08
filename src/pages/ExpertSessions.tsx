import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, Video, Calendar, Clock, Users } from 'lucide-react';

export const ExpertSessions: React.FC = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('');

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await api.getMentorSessions(filter || undefined);
                setSessions(data);
            } catch (err) {
                console.error('Error fetching sessions:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [filter]);

    const statusColors: Record<string, string> = {
        scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
        active: 'bg-green-50 text-green-700 border-green-200',
        ended: 'bg-gray-50 text-gray-600 border-gray-200',
        cancelled: 'bg-red-50 text-red-600 border-red-200',
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
                    <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
                    <p className="text-sm text-gray-500 mt-1">All your expert sessions</p>
                </div>
                <select
                    value={filter}
                    onChange={(e) => { setFilter(e.target.value); setLoading(true); }}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="">All Sessions</option>
                    <option value="scheduled">Upcoming</option>
                    <option value="ended">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {sessions.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <Video className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No sessions found.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {sessions.map((session: any) => {
                        const dateStr = session.scheduled_date
                            ? new Date(session.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                            : '-';
                        const timeStr = session.scheduled_time ? session.scheduled_time.slice(0, 5) : '-';

                        return (
                            <div key={session.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                                        <Video className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {session.topic || 'Expert Session'}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                            <span className="font-medium text-teal-700">{session.venture_name}</span>
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateStr}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeStr}</span>
                                            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {session.founder_name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${statusColors[session.status] || statusColors.scheduled}`}>
                                        {session.status}
                                    </span>
                                    {session.join_url && session.status === 'scheduled' && (
                                        <button
                                            onClick={() => navigate(`/meeting/${session.id}`)}
                                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                                        >
                                            <Video className="w-3.5 h-3.5" /> Join
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
