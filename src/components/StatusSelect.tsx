import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, Zap, ShieldAlert, ChevronDown, Loader2 } from 'lucide-react';

export type StreamStatus = 'Don\'t need help' | 'Need some guidance' | 'Need deep support';

export const STATUS_CONFIG: Record<string, { icon: any, color: string, bg: string, border: string }> = {
    'Don\'t need help': {
        icon: CheckCircle2,
        color: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200'
    },
    'Need some guidance': {
        icon: Zap,
        color: 'text-amber-500',
        bg: 'bg-amber-50',
        border: 'border-amber-200'
    },
    'Need deep support': {
        icon: ShieldAlert,
        color: 'text-red-500',
        bg: 'bg-red-50',
        border: 'border-red-200'
    }
};

const LEGACY_MAPPING: Record<string, string> = {
    'No help needed': 'Don\'t need help',
    'Working on it': 'Need some guidance',
    'Not started': 'Need some guidance',
    'On track': 'Don\'t need help',
    'Need guidance': 'Need some guidance',
    'Need some advice': 'Need some guidance',
    'Completed': 'Don\'t need help',
    'Done': 'Don\'t need help'
};

interface StatusSelectProps {
    status: string;
    onChange: (newStatus: string) => void;
    loading?: boolean;
}

export const StatusSelect: React.FC<StatusSelectProps> = ({ status, onChange, loading = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Resolve legacy status or normalize to visual options
    const mappedStatus = LEGACY_MAPPING[status] || status;
    const normalizedStatus = Object.keys(STATUS_CONFIG).find(
        key => key.toLowerCase() === mappedStatus?.toLowerCase()
    ) || 'Not started';

    const currentConfig = STATUS_CONFIG[normalizedStatus];
    const Icon = currentConfig.icon;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (newStatus: string) => {
        onChange(newStatus);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => !loading && setIsOpen(!isOpen)}
                disabled={loading}
                className={`flex items-center justify-between w-full px-3 py-2.5 sm:py-2 rounded-lg border transition-all duration-200 ${currentConfig.bg} ${currentConfig.border} hover:bg-white hover:shadow-sm`}
            >
                <div className="flex items-center gap-2">
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                        <Icon className={`w-4 h-4 ${currentConfig.color}`} />
                    )}
                    <span className={`text-sm font-medium ${loading ? 'text-gray-400' : 'text-gray-700'}`}>
                        {normalizedStatus}
                    </span>
                </div>
                {!loading && <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
            </button>

            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                        const ItemIcon = config.icon;
                        const isSelected = key === normalizedStatus;

                        return (
                            <button
                                key={key}
                                onClick={() => handleSelect(key)}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${isSelected ? 'bg-gray-50' : ''}`}
                            >
                                <ItemIcon className={`w-4 h-4 ${config.color}`} />
                                <span className={`flex-1 text-left ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                                    {key}
                                </span>
                                {isSelected && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
