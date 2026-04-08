import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, Video, Calendar, Clock, Users, ArrowRight } from 'lucide-react';

export const ExpertDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [ventures, setVentures] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [v, s] = await Promise.all([
                    api.getMentorVentures(),
                    api.getMentorSessions('scheduled'),
                ]);
                setVentures(v);
                setSessions(s);
            } catch (err) {
                console.error('Error loading expert dashboard:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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
                <h1 className="text-2xl font-bold text-gray-900">Expert Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Your assigned ventures and upcoming sessions</p>
            </div>

            {/* Upcoming Sessions */}
            {sessions.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Upcoming Sessions</h2>
                    <div className="space-y-2">
                        {sessions.slice(0, 5).map((session: any) => {
                            const dateStr = session.scheduled_date
                                ? new Date(session.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
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
                                    {session.join_url && (
                                        <button
                                            onClick={() => navigate(`/meeting/${session.id}`)}
                                            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                                        >
                                            <Video className="w-3.5 h-3.5" /> Join
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Assigned Ventures */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Assigned Ventures</h2>
                {ventures.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No ventures assigned yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ventures.map((venture: any) => (
                            <div
                                key={venture.id}
                                onClick={() => navigate(`/expert/venture/${venture.id}`)}
                                className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-teal-200 transition-all cursor-pointer group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="text-base font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                                        {venture.name}
                                    </h3>
                                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors" />
                                </div>
                                <div className="space-y-1.5 text-sm text-gray-500">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        <span>{venture.founder_name || '-'}</span>
                                    </div>
                                    {venture.city && (
                                        <div className="text-xs text-gray-400">{venture.city}</div>
                                    )}
                                </div>
                                {venture.upcoming_sessions > 0 && (
                                    <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-teal-50 text-teal-700 rounded text-xs font-medium">
                                        <Video className="w-3 h-3" />
                                        {venture.upcoming_sessions} upcoming session{venture.upcoming_sessions > 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
