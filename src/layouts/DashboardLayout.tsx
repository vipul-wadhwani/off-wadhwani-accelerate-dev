import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Rocket, Grid, LogOut, Bell } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export const DashboardLayout: React.FC = () => {
    const navigate = useNavigate();
    const { signOut, user, loading } = useAuth();

    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

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

                <nav className="flex-1 p-4 space-y-1">
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
