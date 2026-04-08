import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Rocket, LayoutDashboard, LogOut, User, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ExpertLayout: React.FC = () => {
    const { signOut, user, loading } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        `w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
            isActive
                ? 'bg-teal-50 text-teal-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`;

    return (
        <div className="min-h-screen bg-transparent flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 flex flex-col justify-between">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-teal-800 font-bold text-xl mb-8">
                        <Rocket className="w-6 h-6 text-teal-600" />
                        <span>Accelerate</span>
                    </div>

                    <nav className="space-y-1">
                        <NavLink to="/expert/dashboard" end className={linkClass}>
                            <LayoutDashboard className="w-5 h-5" />
                            My Ventures
                        </NavLink>
                        <NavLink to="/expert/sessions" className={linkClass}>
                            <Video className="w-5 h-5" />
                            Sessions
                        </NavLink>
                        <NavLink to="/expert/profile" className={linkClass}>
                            <User className="w-5 h-5" />
                            My Profile
                        </NavLink>
                    </nav>
                </div>

                <div className="p-6 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
                            {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'M'}
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-medium text-gray-900 truncate">Expert</div>
                            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut();
                            navigate('/login');
                        }}
                        className="flex items-center gap-2 text-teal-600 text-sm font-medium hover:text-teal-700 w-full text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8">
                <Outlet />
            </main>
        </div>
    );
};
