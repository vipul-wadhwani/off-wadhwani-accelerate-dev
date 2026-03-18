import React, { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

const GATE_QUESTIONS = [
    {
        id: 1,
        category: 'Alternatives',
        categoryDesc: 'Can the venture get the support it needs from other sources, or is the Accelerate program uniquely positioned to help?',
        question: 'Can banks and investors provide the required support based on the venture\'s balance sheet and business strength/plans?',
        idealResponse: 'No',
    },
    {
        id: 2,
        category: 'Alternatives',
        categoryDesc: '',
        question: 'Are there other accelerators, consultants, or industry bodies that could provide equivalent growth support to this venture?',
        idealResponse: 'No',
    },
    {
        id: 3,
        category: 'Mindset',
        categoryDesc: 'Is the owner open to external support, willing to invest in growth, and coachable?',
        question: 'Is the owner looking for and willing to take operational and strategic support from the program?',
        idealResponse: 'Yes',
    },
    {
        id: 4,
        category: 'Mindset',
        categoryDesc: '',
        question: 'Is the owner willing and open to fund growth sprints and invest in executing the growth plan?',
        idealResponse: 'Yes',
    },
    {
        id: 5,
        category: 'Resources',
        categoryDesc: 'Does the venture\'s growth journey align with what the Accelerate program can deliver?',
        question: 'Does the owner\'s growth journey plan fit Wadhwani Foundation\'s Sprint offering? Can the program provide resources that would benefit this venture?',
        idealResponse: 'Yes',
    },
    {
        id: 6,
        category: 'Resources',
        categoryDesc: '',
        question: 'Does the venture have the internal capacity (team, bandwidth, infrastructure) to absorb and act on the support provided by the program?',
        idealResponse: 'Yes',
    },
];

interface GateResponse {
    id: number;
    category: string;
    question: string;
    response: 'Yes' | 'No' | null;
    remarks: string;
}

interface PanelGateQuestionsProps {
    ventureId: string;
    savedGateQuestions: any | null;
    onSaved: (data: any) => void;
}

export const PanelGateQuestions: React.FC<PanelGateQuestionsProps> = ({ ventureId, savedGateQuestions, onSaved }) => {
    const [responses, setResponses] = useState<GateResponse[]>(
        GATE_QUESTIONS.map(q => ({
            id: q.id,
            category: q.category,
            question: q.question,
            response: null,
            remarks: '',
        }))
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const allAnswered = responses.every(r => r.response !== null);

    const handleResponseChange = (id: number, value: 'Yes' | 'No') => {
        setResponses(prev => prev.map(r => r.id === id ? { ...r, response: value } : r));
    };

    const handleRemarksChange = (id: number, value: string) => {
        setResponses(prev => prev.map(r => r.id === id ? { ...r, remarks: value } : r));
    };

    const handleSave = async () => {
        if (!allAnswered) return;
        setSaving(true);
        setError('');
        try {
            const result = await api.saveGateQuestions(ventureId, responses);
            onSaved(result.gate_questions || result.data?.gate_questions);
        } catch (err: any) {
            setError(err.message || 'Failed to save gate questions');
        } finally {
            setSaving(false);
        }
    };

    // Read-only mode: show saved responses
    if (savedGateQuestions) {
        const saved = savedGateQuestions.gate_questions || [];
        const categories = ['Alternatives', 'Mindset', 'Resources'];

        return (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/50 to-white">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-orange-500" />
                        <span className="text-base font-bold text-gray-700">Panel Gate Questions</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">Submitted</span>
                    </div>
                    {savedGateQuestions.submitted_at && (
                        <p className="text-xs text-gray-400 mt-1 ml-7">
                            Submitted on {new Date(savedGateQuestions.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                    )}
                </div>
                <div className="divide-y divide-gray-100">
                    {categories.map(cat => {
                        const catQuestions = saved.filter((q: any) => q.category === cat);
                        const catDef = GATE_QUESTIONS.find(q => q.category === cat && q.categoryDesc);
                        return (
                            <div key={cat} className="px-6 py-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">{cat}</span>
                                </div>
                                {catDef?.categoryDesc && (
                                    <p className="text-xs text-gray-500 italic mb-3">{catDef.categoryDesc}</p>
                                )}
                                <div className="space-y-3">
                                    {catQuestions.map((q: any) => {
                                        const def = GATE_QUESTIONS.find(g => g.id === q.id);
                                        const isIdeal = def && q.response === def.idealResponse;
                                        return (
                                            <div key={q.id} className={`p-3 rounded-lg border ${isIdeal ? 'bg-green-50/50 border-green-200' : 'bg-amber-50/50 border-amber-200'}`}>
                                                <div className="flex items-start gap-3">
                                                    <span className="text-xs font-bold text-gray-400 mt-0.5">Q{q.id}</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-gray-800">{q.question}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            {isIdeal ? (
                                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                            ) : (
                                                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                                            )}
                                                            <span className={`text-sm font-bold ${isIdeal ? 'text-green-700' : 'text-amber-700'}`}>{q.response}</span>
                                                        </div>
                                                        {q.remarks && (
                                                            <p className="text-xs text-gray-500 mt-1.5 pl-6 italic">{q.remarks}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Edit mode
    const categories = ['Alternatives', 'Mindset', 'Resources'];

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/50 to-white">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-orange-500" />
                    <span className="text-base font-bold text-gray-700">Panel Gate Questions</span>
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-7">Answer all 6 questions based on your discussion with the venture.</p>
            </div>

            {error && (
                <div className="px-6 py-3 bg-red-50 border-b border-red-100">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div className="divide-y divide-gray-100">
                {categories.map(cat => {
                    const catQuestions = GATE_QUESTIONS.filter(q => q.category === cat);
                    const catDesc = catQuestions.find(q => q.categoryDesc)?.categoryDesc;
                    return (
                        <div key={cat} className="px-6 py-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">{cat}</span>
                            </div>
                            {catDesc && (
                                <p className="text-xs text-gray-500 italic mb-3">{catDesc}</p>
                            )}
                            <div className="space-y-4">
                                {catQuestions.map(q => {
                                    const resp = responses.find(r => r.id === q.id)!;
                                    return (
                                        <div key={q.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50/30">
                                            <div className="flex items-start gap-3">
                                                <span className="text-xs font-bold text-gray-400 mt-0.5">Q{q.id}</span>
                                                <div className="flex-1">
                                                    <p className="text-sm text-gray-800 mb-2">{q.question}</p>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResponseChange(q.id, 'Yes')}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                                                                resp.response === 'Yes'
                                                                    ? 'bg-green-100 border-green-300 text-green-800'
                                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-700'
                                                            }`}
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            Yes
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResponseChange(q.id, 'No')}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                                                                resp.response === 'No'
                                                                    ? 'bg-red-100 border-red-300 text-red-800'
                                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-700'
                                                            }`}
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            No
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={resp.remarks}
                                                        onChange={(e) => handleRemarksChange(q.id, e.target.value)}
                                                        placeholder="Remarks (optional)"
                                                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:ring-2 focus:ring-orange-200 focus:border-orange-300 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                    {responses.filter(r => r.response !== null).length}/6 answered
                </p>
                <button
                    onClick={handleSave}
                    disabled={!allAnswered || saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                    {saving ? (<><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>) : 'Save Gate Questions'}
                </button>
            </div>
        </div>
    );
};
