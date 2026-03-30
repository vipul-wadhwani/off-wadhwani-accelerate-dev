import React, { useState } from 'react';
import { Phone, Video, Mail, FileText, Calendar, Users as UsersIcon, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Interaction } from '../../types/interactions';

interface InteractionCardProps {
    interaction: Interaction;
    onDelete?: () => void;
}

const TYPE_CONFIG = {
    call: { icon: Phone, label: 'Call', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    meeting: { icon: Video, label: 'Meeting', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    email: { icon: Mail, label: 'Email', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    note: { icon: FileText, label: 'Note', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' }
};

export const InteractionCard: React.FC<InteractionCardProps> = ({ interaction, onDelete }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const config = TYPE_CONFIG[interaction.interaction_type];
    const Icon = config.icon;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const truncateText = (text: string, maxLength: number) => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    return (
        <div className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
                {/* Type Icon */}
                <div className={`w-10 h-10 rounded-lg ${config.bg} ${config.border} border flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${config.bg} ${config.color} border ${config.border}`}>
                                    {config.label}
                                </span>
                                {interaction.title && (
                                    <h4 className="text-sm font-semibold text-gray-900">{interaction.title}</h4>
                                )}
                            </div>

                            {/* Metadata */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatDate(interaction.interaction_date)}
                                </div>

                                {interaction.participants && interaction.participants.length > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <UsersIcon className="w-3.5 h-3.5" />
                                        {interaction.participants.length} participant{interaction.participants.length > 1 ? 's' : ''}
                                    </div>
                                )}

                                {interaction.created_by_user && (
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <span className="text-xs">by {interaction.created_by_user.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                                title="Delete interaction"
                            >
                                <Trash2 className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
                            </button>
                        )}
                    </div>

                    {/* Transcript/Notes */}
                    <div className="mt-3">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
                            {isExpanded ? interaction.transcript : truncateText(interaction.transcript, 200)}
                        </div>

                        {interaction.transcript.length > 200 && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="mt-2 flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700"
                            >
                                {isExpanded ? (
                                    <>
                                        <ChevronUp className="w-3.5 h-3.5" />
                                        Show less
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                        Show more
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Participants List (if any) */}
                    {isExpanded && interaction.participants && interaction.participants.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Participants</p>
                            <div className="flex flex-wrap gap-2">
                                {interaction.participants.map((participant, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                    >
                                        {participant}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
