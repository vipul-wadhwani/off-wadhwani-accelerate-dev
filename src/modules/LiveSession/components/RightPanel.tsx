import React, { useState } from 'react';
import { FileText, MessageSquare, Sparkles, Users, X } from 'lucide-react';
import { BriefPanel } from '../../PreMeetingBrief';
import { TranscriptPanel } from './TranscriptPanel';
import { InsightsPanel } from './InsightsPanel';
import { DiscoverExpertsPage } from '../../ExpertMatching';

type Tab = 'brief' | 'transcript' | 'insights' | 'actions';

interface RightPanelProps {
    sessionId: string;
    ventureId: string;
    ventureName?: string;
    transcriptChunks: Array<{ speaker: string; text: string; time: string }>;
    topic?: string;
}

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'brief', label: 'Brief', icon: FileText },
    { id: 'transcript', label: 'Transcript', icon: MessageSquare },
    { id: 'insights', label: 'Insights', icon: Sparkles },
    { id: 'actions', label: 'Actions', icon: Users },
];

export const RightPanel: React.FC<RightPanelProps> = ({ sessionId, ventureId, ventureName, transcriptChunks, topic }) => {
    const [activeTab, setActiveTab] = useState<Tab>('brief');
    const [showExpertModal, setShowExpertModal] = useState(false);

    const currentTranscript = transcriptChunks
        .map(c => `${c.speaker}: ${c.text}`)
        .join('\n');

    return (
        <>
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
                    <div className="space-y-3">
                        <button
                            onClick={() => setShowExpertModal(true)}
                            className="w-full flex items-center gap-3 p-3 bg-teal-900/40 border border-teal-800 rounded-lg hover:bg-teal-900/60 transition-colors text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-teal-300">Connect to Expert</p>
                                <p className="text-[11px] text-gray-400">AI-match & book an expert for this venture</p>
                            </div>
                        </button>

                        <button
                            disabled
                            className="w-full flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-left opacity-50 cursor-not-allowed"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-400">Register for Masterclass</p>
                                <p className="text-[11px] text-gray-500">Coming soon</p>
                            </div>
                        </button>

                        <button
                            disabled
                            className="w-full flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-left opacity-50 cursor-not-allowed"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-400">Connect to Service Provider</p>
                                <p className="text-[11px] text-gray-500">Coming soon</p>
                            </div>
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* Expert Connect Modal — overlays the meeting */}
        {showExpertModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Connect to Expert</h2>
                            <p className="text-sm text-gray-500">Find and book an expert for {ventureName || 'this venture'}</p>
                        </div>
                        <button
                            onClick={() => setShowExpertModal(false)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6">
                        <DiscoverExpertsPage ventureId={ventureId} ventureName={ventureName} />
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
