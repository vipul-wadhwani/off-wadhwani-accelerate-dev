import React, { useState } from 'react';
import { FileText, MessageSquare, Sparkles, Users } from 'lucide-react';
import { BriefPanel } from '../../PreMeetingBrief';
import { TranscriptPanel } from './TranscriptPanel';
import { InsightsPanel } from './InsightsPanel';

type Tab = 'brief' | 'transcript' | 'insights' | 'actions';

interface RightPanelProps {
    sessionId: string;
    transcriptChunks: Array<{ speaker: string; text: string; time: string }>;
    topic?: string;
}

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'brief', label: 'Brief', icon: FileText },
    { id: 'transcript', label: 'Transcript', icon: MessageSquare },
    { id: 'insights', label: 'Insights', icon: Sparkles },
    { id: 'actions', label: 'Actions', icon: Users },
];

export const RightPanel: React.FC<RightPanelProps> = ({ sessionId, transcriptChunks, topic }) => {
    const [activeTab, setActiveTab] = useState<Tab>('brief');

    const currentTranscript = transcriptChunks
        .map(c => `${c.speaker}: ${c.text}`)
        .join('\n');

    return (
        <div className="w-[360px] bg-gray-900 border-l border-gray-700 flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex border-b border-gray-700">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
                                isActive
                                    ? 'text-teal-400 border-b-2 border-teal-400 bg-gray-800/50'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                            {tab.id === 'transcript' && transcriptChunks.length > 0 && (
                                <span className="w-4 h-4 rounded-full bg-teal-900 text-teal-300 text-[9px] flex items-center justify-center">
                                    {transcriptChunks.length}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'brief' && <BriefPanel sessionId={sessionId} />}
                {activeTab === 'transcript' && <TranscriptPanel chunks={transcriptChunks} />}
                {activeTab === 'insights' && (
                    <InsightsPanel sessionId={sessionId} currentTranscript={currentTranscript} topic={topic} />
                )}
                {activeTab === 'actions' && (
                    <div className="text-center py-8">
                        <Users className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                        <p className="text-sm text-gray-400">Action items coming soon</p>
                        <p className="text-xs text-gray-500 mt-1">Connect to Expert, Masterclass, Service Provider</p>
                    </div>
                )}
            </div>
        </div>
    );
};
