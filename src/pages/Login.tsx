import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Rocket, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/logger';

export const Login: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isApply = searchParams.get('apply') === 'true';
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navigateByRole = (role?: string) => {
        let target = '/dashboard';
        if (isApply) {
            target = '/dashboard/new-application';
        } else if (role === 'venture_mgr') {
            target = '/vmanager/dashboard';
        } else if (role === 'committee_member') {
            target = '/committee/dashboard';
        } else if (role === 'ops_manager') {
            target = '/ops/dashboard';
        } else if (role === 'admin') {
            target = '/admin/dashboard';
        } else if (role === 'success_mgr') {
            target = '/vsm/dashboard';
        }
        logger.info('Login', `Navigating to ${target} for role: ${role}`);
        navigate(target);
    };

    const handleLogin = async (e?: React.FormEvent) => {
        e?.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const signedInUser = await signIn(email, password);
            navigateByRole(signedInUser?.user_metadata?.role);
        } catch (err: any) {
            logger.error('Login', `Login failed for ${email}`, err);
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-orange-50 flex flex-col items-center justify-center p-4">

            {/* Header Branding */}
            <div className="mb-8 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-red-600 rounded-xl mb-4 shadow-lg shadow-red-600/20">
                    <Rocket className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Sign in to your account</h1>
                <p className="mt-2 text-gray-600">
                    Or <button onClick={() => navigate('/signup')} className="text-red-600 font-medium hover:underline">create a new account</button>
                </p>
            </div>

            {/* Main Card */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6">

                {/* Form */}
                <div className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <Input
                        label="Email address"
                        placeholder="you@example.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        icon={<Mail className="w-4 h-4" />}
                    />
                    <Input
                        label="Password"
                        placeholder="••••••••"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock className="w-4 h-4" />}
                    />

                    <Button className="w-full" onClick={() => handleLogin()} disabled={loading}>
                        <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>


            </div>
        </div>
    );
};
