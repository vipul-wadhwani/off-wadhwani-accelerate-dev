import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Rocket, LayoutDashboard, Users, BarChart3, Building2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminLayout: React.FC = () => {
    const { signOut, user, loading } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    const navItems = [
        { to: '/admin/dashboard', label: 'Application Dashboard', icon: LayoutDashboard, end: true },
        { to: '/admin/dashboard/ventures', label: 'Venture Dashboard', icon: Building2, end: false },
        { to: '/admin/dashboard/screening-performance', label: 'Screening Performance', icon: BarChart3, end: false },
        { to: '/admin/dashboard/users', label: 'Users', icon: Users, end: false },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-[#1e1b4b] fixed h-full z-10 flex flex-col justify-between">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-white font-bold text-xl mb-8">
                        <Rocket className="w-6 h-6 text-indigo-300" />
                        <span>Accelerate</span>
                    </div>

                    <nav className="space-y-1">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-left transition-colors text-sm ${
                                        isActive
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-indigo-200 hover:bg-indigo-900/50 hover:text-white'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="p-6 border-t border-indigo-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div className="overflow-hidden">
                            <div className="font-medium text-white truncate text-sm">{user?.user_metadata?.full_name || 'Admin'}</div>
                            <div className="text-xs text-indigo-300 truncate">{user?.email}</div>
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            await signOut();
                            navigate('/login');
                        }}
                        className="flex items-center gap-2 text-indigo-300 text-sm font-medium hover:text-white w-full text-left"
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
