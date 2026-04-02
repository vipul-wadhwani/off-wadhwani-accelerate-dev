import React, { useState, useEffect } from 'react';
import { X, Star, Sparkles, Loader2, ExternalLink, Calendar } from 'lucide-react';
import { api } from '../../lib/api';

type RecommendationType = 'expert_connect' | 'service_provider' | 'masterclass' | 'research';

interface ResourceRecommendationModalProps {
    ventureId: string;
    deliverableId: string;
    deliverableTitle: string;
    ventureName: string;
    type: RecommendationType;
    onClose: () => void;
}

const TYPE_LABELS: Record<RecommendationType, string> = {
    expert_connect: 'Expert Connect',
    service_provider: 'Service Provider',
    masterclass: 'Masterclass',
    research: 'Research',
};

const _TYPE_ACTION_LABELS: Record<RecommendationType, string[]> = {
    expert_connect: ['Recommend', 'Request Meeting'],
    service_provider: ['Recommend', 'Connect'],
    masterclass: ['Register'],
    research: ['View Resource'],
};
void _TYPE_ACTION_LABELS; // reserved for future use

// Avatar placeholder using initials
const Avatar: React.FC<{ name: string }> = ({ name }) => {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
    const color = colors[name.length % colors.length];
    return (
        <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
            {initials}
        </div>
    );
};

const RatingBadge: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center gap-1 text-amber-500">
        <Star className="w-4 h-4 fill-amber-400" />
        <span className="font-semibold text-sm">{rating.toFixed(1)}</span>
    </div>
);

const TagList: React.FC<{ tags: string[] }> = ({ tags }) => (
    <div className="flex flex-wrap gap-1.5 mt-3">
        {tags.map((tag, i) => (
            <span key={i} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs text-gray-600 font-medium">{tag}</span>
        ))}
    </div>
);

// Card renderers per type
const ExpertCard: React.FC<{ item: any }> = ({ item }) => (
    <div className="border border-gray-200 rounded-xl p-5 flex flex-col">
        <div className="flex items-start gap-3 mb-3">
            <Avatar name={item.name} />
            <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900">{item.name}</h4>
                <p className="text-sm text-gray-500">{item.title}</p>
            </div>
            <RatingBadge rating={item.rating} />
        </div>
        <p className="text-sm text-gray-600 mb-auto">{item.description}</p>
        <TagList tags={item.tags || []} />
        <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100">
            <button className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                Recommend
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                Request Meeting <ExternalLink className="w-3.5 h-3.5" />
            </button>
        </div>
    </div>
);

const ServiceProviderCard: React.FC<{ item: any }> = ({ item }) => (
    <div className="border border-gray-200 rounded-xl p-5 flex flex-col">
        <div className="flex items-start gap-3 mb-3">
            <Avatar name={item.name} />
            <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900">{item.name}</h4>
            </div>
            <RatingBadge rating={item.rating} />
        </div>
        <p className="text-sm text-gray-600 mb-auto">{item.description}</p>
        <TagList tags={item.tags || []} />
        <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-gray-100">
            <button className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                Recommend
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                Connect <ExternalLink className="w-3.5 h-3.5" />
            </button>
        </div>
    </div>
);

const MasterclassCard: React.FC<{ item: any }> = ({ item }) => (
    <div className="border border-gray-200 rounded-xl p-5 flex flex-col">
        <div className="flex items-start gap-3 mb-3">
            <Avatar name={item.instructor || item.title} />
            <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900">{item.title}</h4>
                <p className="text-sm text-gray-500">{item.instructor}</p>
            </div>
        </div>
        <p className="text-sm text-gray-600 mb-auto">{item.description}</p>
        <TagList tags={item.tags || []} />
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {item.date}
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                Register <ExternalLink className="w-3.5 h-3.5" />
            </button>
        </div>
    </div>
);

const ResearchCard: React.FC<{ item: any }> = ({ item }) => (
    <div className="border border-gray-200 rounded-xl p-5 flex flex-col">
        <h4 className="font-semibold text-gray-900 mb-0.5">{item.title}</h4>
        <p className="text-sm text-gray-500 mb-2">{item.type}</p>
        <p className="text-sm text-gray-600 mb-auto">{item.description}</p>
        <TagList tags={item.tags || []} />
        <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-100">
            <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                View Resource <ExternalLink className="w-3.5 h-3.5" />
            </button>
        </div>
    </div>
);

const CARD_COMPONENTS: Record<RecommendationType, React.FC<{ item: any }>> = {
    expert_connect: ExpertCard,
    service_provider: ServiceProviderCard,
    masterclass: MasterclassCard,
    research: ResearchCard,
};

export const ResourceRecommendationModal: React.FC<ResourceRecommendationModalProps> = ({
    ventureId,
    deliverableId,
    deliverableTitle,
    ventureName,
    type,
    onClose,
}) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecommendations();
    }, [type]);

    const fetchRecommendations = async () => {
        setLoading(true);
        try {
            const result = await api.generateRecommendations(ventureId, deliverableId, type);
            const rec = result?.recommendation;
            setItems(rec?.data || []);
        } catch (err) {
            console.error('Error fetching recommendations:', err);
        } finally {
            setLoading(false);
        }
    };

    const CardComponent = CARD_COMPONENTS[type];

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 overflow-y-auto py-8" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-8 pt-6 pb-4 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
                                <Sparkles className="w-4 h-4" />
                                AI Recommendations
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">
                                {TYPE_LABELS[type]} for {ventureName}
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Suggested resources for: <span className="font-medium text-gray-700">{deliverableTitle}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-8 py-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-3" />
                            <p className="text-sm">Generating recommendations...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">No recommendations available.</div>
                    ) : (
                        <div className="grid grid-cols-2 gap-5">
                            {items.map((item, idx) => (
                                <CardComponent key={idx} item={item} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
