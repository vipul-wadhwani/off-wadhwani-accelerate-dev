import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, Video, Calendar, Clock, Users } from 'lucide-react';

export const UpcomingMeetingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const role = user?.user_metadata?.role;
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id || !role) return;
        const fetchSessions = async () => {
            try {
                // Get ventures for this user (by ownership or assignment)
                let ventureIds: string[] = [];

                if (role === 'venture_mgr' || role === 'committee_member') {
                    // VP/VM: ventures assigned to them
                    const { data: ventures } = await supabase
                        .from('ventures')
                        .select('id, name, founder_name')
                        .eq('assigned_vm_id', user.id);
                    ventureIds = (ventures || []).map((v: any) => v.id);
                } else {
                    // Entrepreneur: ventures they own
                    const { data: ventures } = await supabase
                        .from('ventures')
                        .select('id, name, founder_name')
                        .eq('user_id', user.id);
                    ventureIds = (ventures || []).map((v: any) => v.id);
                }

                if (ventureIds.length === 0) {
                    setSessions([]);
                    return;
                }

                // Fetch scheduled sessions for those ventures
                const { data: sessionData } = await supabase
                    .from('mentor_sessions')
                    .select('id, topic, scheduled_date, scheduled_time, duration_minutes, join_url, zoom_meeting_id, status, venture_id, mentor_id')
                    .in('venture_id', ventureIds)
                    .eq('status', 'scheduled')
                    .gte('scheduled_date', new Date().toISOString().split('T')[0])
                    .order('scheduled_date', { ascending: true })
                    .order('scheduled_time', { ascending: true })
                    .limit(20);

                // Get venture names + mentor names
                const { data: ventures } = await supabase
                    .from('ventures')
                    .select('id, name')
                    .in('id', ventureIds);
                const ventureMap = new Map((ventures || []).map((v: any) => [v.id, v.name]));

                const mentorIds = [...new Set((sessionData || []).map((s: any) => s.mentor_id))];
                let mentorMap = new Map<string, string>();
                if (mentorIds.length > 0) {
                    const { data: mentors } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', mentorIds);
                    mentorMap = new Map((mentors || []).map((m: any) => [m.id, m.full_name]));
                }

                const enriched = (sessionData || []).map((s: any) => ({
                    ...s,
                    venture_name: ventureMap.get(s.venture_id) || '',
                    expert_name: mentorMap.get(s.mentor_id) || 'Expert',
                }));

                setSessions(enriched);
            } catch (err) {
                console.error('Error fetching sessions:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [user?.id, role]);

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
