import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Rocket, Grid, LogOut, Bell, Video, Calendar, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const DashboardLayout: React.FC = () => {
    const navigate = useNavigate();
    const { signOut, user, loading } = useAuth();
    const [sessions, setSessions] = useState<any[]>([]);
    const [sessionsOpen, setSessionsOpen] = useState(true);

    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (!user) return;
        api.getMyMentorSessions().then(setSessions).catch(() => {});
    }, [user]);

    return (

        <div className="flex h-screen bg-transparent">

            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-10">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-xl">
                        <div className="p-1.5 bg-red-700 rounded-lg">
                            <Rocket className="w-5 h-5 text-white" />
                        </div>
                        <span>Accelerate</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <NavLink
                        to="/dashboard"
                        end
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                        }
                    >
                        <Grid className="w-5 h-5" />
                        My Ventures
                    </NavLink>

                    {/* Upcoming Expert Sessions */}
                    {sessions.length > 0 && (
                        <div className="mt-4">
                            <button
                                onClick={() => setSessionsOpen(!sessionsOpen)}
                                className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-teal-700 uppercase tracking-wide"
                            >
                                <div className="flex items-center gap-2">
                                    <Video className="w-3.5 h-3.5" />
                                    Upcoming Sessions
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
                                        {sessions.length}
                                    </span>
                                </div>
                                {sessionsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {sessionsOpen && (
                                <div className="space-y-2 mt-1 px-2">
                                    {sessions.slice(0, 3).map((session: any) => {
                                        const dateStr = session.scheduled_date
                                            ? new Date(session.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                                            : '-';
                                        const timeStr = session.scheduled_time ? session.scheduled_time.slice(0, 5) : '';

                                        return (
                                            <div key={session.id} className="bg-teal-50 border border-teal-100 rounded-lg p-3">
                                                <div className="text-xs font-semibold text-gray-900 truncate">
                                                    {session.topic || 'Expert Session'}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="w-3 h-3 text-teal-600" />
                                                        {dateStr} {timeStr && `at ${timeStr}`}
                                                    </div>
                                                    <div className="truncate">
                                                        with {session.mentor_name}
                                                    </div>
                                                </div>
                                                {session.join_url && (
                                                    <a
                                                        href={session.join_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-colors"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                        Join Session
                                                    </a>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {sessions.length > 3 && (
                                        <div className="text-xs text-teal-600 font-medium text-center py-1">
                                            +{sessions.length - 3} more session{sessions.length - 3 > 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold">
                            {user?.email?.[0].toUpperCase() || 'E'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="text-sm font-medium text-gray-900 truncate">{user?.email || 'Venture'}</div>
                            <div className="text-xs text-gray-500 truncate">ENTREPRENEUR</div>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut();
                            navigate('/login');
                        }}
                        className="flex items-center gap-2 px-2 text-sm text-red-600 font-medium hover:text-red-700 w-full"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 ml-64 flex flex-col min-w-0 overflow-hidden">
                {/* Top Header */}
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8">
                    <h1 className="text-gray-500 text-sm">Assisted Growth Platform</h1>
                    <button className="text-gray-400 hover:text-gray-600">
                        <Bell className="w-5 h-5" />
                    </button>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
