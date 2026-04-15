import React, { useState } from 'react';
import { FileText, MessageSquare, Sparkles, Users, X } from 'lucide-react';
import { BriefPanel } from '../../PreMeetingBrief';
import { TranscriptPanel } from './TranscriptPanel';
import { InsightsPanel } from './InsightsPanel';
import { InlineExpertPanel } from './InlineExpertPanel';

type Tab = 'brief' | 'transcript' | 'insights' | 'actions';

interface RightPanelProps {
    sessionId: string;
    ventureId: string;
    ventureName?: string;
    transcriptChunks: Array<{ speaker: string; text: string; time: string }>;
    topic?: string;
    userRole?: string;
}

const ALL_TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'transcript', label: 'Transcript', icon: MessageSquare },
    { id: 'insights', label: 'AI Insights', icon: Sparkles },
    { id: 'actions', label: 'Action Items', icon: Users },
    { id: 'brief', label: 'Brief', icon: FileText },
];

export const RightPanel: React.FC<RightPanelProps> = ({ sessionId, ventureId, ventureName, transcriptChunks, topic, userRole }) => {
    const isEntrepreneur = userRole === 'entrepreneur';
    const TABS = isEntrepreneur ? ALL_TABS.filter(t => t.id === 'transcript' || t.id === 'insights') : ALL_TABS;
    const [activeTab, setActiveTab] = useState<Tab>('transcript');
    const [showExpertModal, setShowExpertModal] = useState(false);

    const currentTranscript = transcriptChunks
        .map(c => `${c.speaker}: ${c.text}`)
        .join('\n');

    return (
        <>
        <div data-right-panel className="w-[420px] bg-white border-l border-gray-200 flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                                isActive
                                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            {tab.label}
                            {tab.id === 'transcript' && transcriptChunks.length > 0 && (
                                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                                    {transcriptChunks.length}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
                {activeTab === 'transcript' && <TranscriptPanel chunks={transcriptChunks} />}
                {activeTab === 'insights' && (
                    <InsightsPanel sessionId={sessionId} currentTranscript={currentTranscript} topic={topic} />
                )}
                {activeTab === 'actions' && (
                    <ActionItemsList onConnectExpert={() => setShowExpertModal(true)} />
                )}
                {activeTab === 'brief' && <BriefPanel sessionId={sessionId} />}
            </div>
        </div>

        {/* Connect to Expert Modal */}
        {showExpertModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowExpertModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🤝</span>
                            <h2 className="text-base font-bold text-gray-900">Connect to Expert</h2>
                        </div>
                        <button onClick={() => setShowExpertModal(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5">
                        <InlineExpertPanel ventureId={ventureId} ventureName={ventureName} />
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

/* ---- Action Items List ---- */

const ActionItemsList: React.FC<{ onConnectExpert: () => void }> = ({ onConnectExpert }) => {
    const actions = [
        { label: 'Playbook', icon: '📒', enabled: false },
        { label: 'Connect to Expert', icon: '🤝', enabled: true, onClick: onConnectExpert },
        { label: 'Register for Masterclass', icon: '🎓', enabled: false },
        { label: 'Service Provider', icon: '🔧', enabled: false },
        { label: 'Research', icon: '🔍', enabled: false },
    ];

    return (
        <div className="space-y-4">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                Select action items agreed in this session:
            </span>
            <div className="space-y-2">
                {actions.map(({ label, icon, enabled, onClick }) => (
                    <button
                        key={label}
                        onClick={enabled ? onClick : undefined}
                        disabled={!enabled}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
                            enabled
                                ? 'border-indigo-300 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 cursor-pointer ring-1 ring-indigo-200'
                                : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                        {icon} {label}
                    </button>
                ))}
            </div>
        </div>
    );
};
