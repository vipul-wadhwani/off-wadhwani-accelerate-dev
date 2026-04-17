import React from 'react';
import { ClipboardList, Users, Map } from 'lucide-react';
import type { Feature } from '../types';
import { FEATURES } from '../types';

const ICONS: Record<Feature, React.ReactNode> = {
    screening: <ClipboardList className="w-4 h-4" />,
    panel: <Users className="w-4 h-4" />,
    roadmap: <Map className="w-4 h-4" />,
};

interface Props {
    selected: Feature | null;
    onChange: (f: Feature) => void;
}

export const FeatureSelector: React.FC<Props> = ({ selected, onChange }) => (
    <div className="space-y-2">
        {FEATURES.map((f) => (
            <button
                key={f.id}
                type="button"
                onClick={() => onChange(f.id)}
                className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                    selected === f.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50 text-gray-700'
                }`}
            >
                <span className={`mt-0.5 flex-shrink-0 ${selected === f.id ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {ICONS[f.id]}
                </span>
                <div>
                    <div className="text-sm font-medium leading-snug">{f.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-snug">{f.description}</div>
                </div>
            </button>
        ))}
    </div>
);
