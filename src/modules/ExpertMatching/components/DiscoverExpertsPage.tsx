import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useExpertMatch } from '../hooks/useExpertMatch';
import { ExpertMatchCard } from './ExpertMatchCard';
import { Loader2, Search, Sparkles, Users } from 'lucide-react';

interface DiscoverExpertsPageProps {
    ventureId?: string;
    onSendRequest?: (expertId: string) => void;
}

export const DiscoverExpertsPage: React.FC<DiscoverExpertsPageProps> = ({ ventureId: propVentureId, onSendRequest }) => {
    const params = useParams<{ id: string }>();
    const ventureId = propVentureId || params.id || '';
    const { matches, allExperts, loading, searching, findMatches, searchExperts } = useExpertMatch();
    const [searchQuery, setSearchQuery] = useState('');
    const [hasMatchedOnce, setHasMatchedOnce] = useState(false);

    useEffect(() => {
        searchExperts();
    }, [searchExperts]);

    const handleAiMatch = async () => {
        if (!ventureId) return;
        await findMatches(ventureId);
        setHasMatchedOnce(true);
    };

    const handleSearch = () => {
        searchExperts({ search: searchQuery });
    };

    // Filter out already-matched experts from the "all" list
    const matchedIds = new Set(matches.map(m => m.expert_id));
    const remainingExperts = allExperts.filter(e => !matchedIds.has(e.id));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Discover Experts</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Find the best experts for your venture using AI matching or browse all available experts
                </p>
            </div>

            {/* Search + AI Match */}
            <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search by name, expertise, or industry..."
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                    Search
                </button>
                {ventureId && (
                    <button
                        onClick={handleAiMatch}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        AI Match Top 5
                    </button>
                )}
            </div>

            {/* AI Matched Experts */}
            {hasMatchedOnce && matches.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-teal-600" />
                        <h2 className="text-lg font-semibold text-gray-900">AI Recommended</h2>
                        <span className="text-xs text-gray-500">Top {matches.length} matches for your venture</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matches.map(expert => (
                            <ExpertMatchCard
                                key={expert.expert_id}
                                expert={expert}
                                isAiMatch
                                onSendRequest={onSendRequest}
                            />
                        ))}
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                    <span className="ml-3 text-sm text-gray-500">Finding best matches with AI...</span>
                </div>
            )}

            {/* All Experts */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-900">All Experts</h2>
                    <span className="text-xs text-gray-500">({remainingExperts.length})</span>
                </div>
                {searching ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : remainingExperts.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">No experts found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {remainingExperts.map(expert => (
                            <ExpertMatchCard
                                key={expert.id}
                                expert={expert}
                                onSendRequest={onSendRequest}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
