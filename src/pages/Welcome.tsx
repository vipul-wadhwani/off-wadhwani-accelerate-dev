import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FileText } from 'lucide-react';
import React from 'react';

export const Welcome: React.FC = () => {
    const navigate = useNavigate();

    const handleApply = () => {
        navigate('/apply');
    };

    return (
        <div className="min-h-screen w-full bg-orange-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px]">
                {/* Left Panel */}
                <div className="w-full md:w-1/2 bg-gradient-to-br from-red-600 to-orange-600 p-12 flex flex-col justify-center text-white relative overflow-hidden">
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-yellow-200 via-transparent to-transparent" />

                    <div className="relative z-10 space-y-6">
                        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                            Assisted Growth Platform
                        </h1>
                        <p className="text-orange-50 text-lg leading-relaxed max-w-md">
                            The Assisted Venture Growth Platform. From application to execution, we help you scale your venture with AI-driven insights and expert connections.
                        </p>

                        {/* Apply CTA on left panel */}
                        <button
                            onClick={handleApply}
                            className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors group"
                        >
                            <FileText className="w-4 h-4" />
                            Apply to the Accelerate Program
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                    </div>
                </div>

                {/* Right Panel */}
                <div className="w-full md:w-1/2 p-12 flex flex-col justify-center bg-white">
                    <div className="max-w-sm mx-auto w-full space-y-4">
                        <div className="space-y-2 mb-4">
                            <h2 className="text-3xl font-bold text-gray-900">Welcome</h2>
                            <p className="text-gray-500">Sign in to access your dashboard.</p>
                        </div>

                        <Button variant="primary" onClick={() => navigate('/login')}>
                            Log In
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/signup')}>
                            Sign Up
                        </Button>

                        {/* Divider */}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-100" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-widest">New to the program?</span>
                            </div>
                        </div>

                        {/* Apply Button */}
                        <button
                            onClick={handleApply}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-dashed border-orange-300 text-orange-600 font-semibold text-sm hover:bg-orange-50 hover:border-orange-400 transition-all"
                        >
                            <FileText className="w-4 h-4" />
                            Apply to Accelerate Program
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
