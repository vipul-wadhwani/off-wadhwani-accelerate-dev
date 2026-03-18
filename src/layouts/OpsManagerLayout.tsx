import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Rocket, LayoutDashboard, Phone, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const OpsManagerLayout: React.FC = () => {
    const { signOut, user, loading } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    const navItems = [
        { to: '/ops/dashboard', label: 'Applications', icon: LayoutDashboard, end: true },
        { to: '/ops/dashboard/scheduled-calls', label: 'Scheduled Calls', icon: Phone, end: false },
    ];

    return (
        <div className="min-h-screen bg-transparent flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed h-full z-10 flex flex-col justify-between">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-xl mb-8">
                        <Rocket className="w-6 h-6 text-indigo-600" />
                        <span>Accelerate</span>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    `w-full flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-left transition-colors ${
                                        isActive
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="p-6 border-t border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            {user?.email?.[0].toUpperCase() || 'O'}
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-medium text-gray-900 truncate">Ops Manager</div>
                            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut();
                            navigate('/login');
                        }}
                        className="flex items-center gap-2 text-indigo-600 text-sm font-medium hover:text-indigo-700 w-full text-left"
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
