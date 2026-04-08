import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Loader2, Save, Plus, X } from 'lucide-react';

export const ExpertProfile: React.FC = () => {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
    const [maxSessions, setMaxSessions] = useState(5);
    const [newExpertise, setNewExpertise] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const p = await api.getMentorProfile();
                setProfile(p);
                setFullName(p.full_name || '');
                setBio(p.bio || '');
                setExpertiseAreas(p.expertise_areas || []);
                setMaxSessions(p.max_sessions_per_week || 5);
            } catch (err) {
                console.error('Error fetching profile:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await api.updateMentorProfile({
                full_name: fullName,
                bio,
                expertise_areas: expertiseAreas,
                max_sessions_per_week: maxSessions,
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Error saving profile:', err);
        } finally {
            setSaving(false);
        }
    };

    const addExpertise = () => {
        const trimmed = newExpertise.trim();
        if (trimmed && !expertiseAreas.includes(trimmed)) {
            setExpertiseAreas([...expertiseAreas, trimmed]);
            setNewExpertise('');
        }
    };

    const removeExpertise = (area: string) => {
        setExpertiseAreas(expertiseAreas.filter(a => a !== area));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your expert profile and expertise</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                </div>

                {/* Email (read-only) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                        type="text"
                        value={profile?.email || ''}
                        disabled
                        className="w-full px-4 py-2.5 border border-gray-100 rounded-lg text-sm bg-gray-50 text-gray-500"
                    />
                </div>

                {/* Bio */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        placeholder="Tell entrepreneurs about your background and expertise..."
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                    />
                </div>

                {/* Expertise Areas */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expertise Areas</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {expertiseAreas.map((area) => (
                            <span key={area} className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium">
                                {area}
                                <button onClick={() => removeExpertise(area)} className="hover:text-teal-900">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newExpertise}
                            onChange={(e) => setNewExpertise(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise())}
                            placeholder="Add expertise (e.g., Product Strategy)"
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                            onClick={addExpertise}
                            className="px-3 py-2 bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Max Sessions */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Sessions Per Week</label>
                    <select
                        value={maxSessions}
                        onChange={(e) => setMaxSessions(Number(e.target.value))}
                        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                </div>

                {/* Save Button */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                    {saved && (
                        <span className="text-sm text-green-600 font-medium">Profile saved!</span>
                    )}
                </div>
            </div>
        </div>
    );
};
