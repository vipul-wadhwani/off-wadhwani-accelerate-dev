import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Rocket, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const VPVMLayout: React.FC = () => {
    const { signOut, user, loading } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    const role = user?.user_metadata?.role;
    const roleLabel = role === 'venture_mgr' ? 'VM (Prime)' : 'VP (Core/Select)';

    return (
        <div className="min-h-screen bg-transparent flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 flex flex-col justify-between">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-red-900 font-bold text-xl mb-8">
                        <Rocket className="w-6 h-6 text-red-600" />
                        <span>Accelerate</span>
                    </div>

                    <nav className="space-y-1">
                        <NavLink
                            to="/vpvm/dashboard"
                            end
                            className={({ isActive }) =>
                                `w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                                    isActive
                                        ? 'bg-red-50 text-red-700'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`
                            }
                        >
                            <LayoutDashboard className="w-5 h-5" />
                            My Ventures
                        </NavLink>
                    </nav>
                </div>

                <div className="p-6 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold">
                            {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'V'}
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-medium text-gray-900 truncate">{roleLabel}</div>
                            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut();
                            navigate('/login');
                        }}
                        className="flex items-center gap-2 text-red-600 text-sm font-medium hover:text-red-700 w-full text-left"
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
