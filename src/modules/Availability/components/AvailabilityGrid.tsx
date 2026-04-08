import React, { useState, useEffect } from 'react';
import { DAYS, WEEKDAYS, TIME_SLOTS, type AvailabilitySlot } from '../types';

interface AvailabilityGridProps {
    slots: AvailabilitySlot[];
    onChange: (slots: AvailabilitySlot[]) => void;
    readOnly?: boolean;
}

export const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({ slots, onChange, readOnly }) => {
    // Build a Set of "day-time" keys for quick lookup
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        const keys = new Set(slots.map(s => `${s.day_of_week}-${s.start_time}`));
        setSelected(keys);
    }, [slots]);

    const toggle = (day: number, timeSlot: typeof TIME_SLOTS[number]) => {
        if (readOnly) return;
        const key = `${day}-${timeSlot.value}`;
        const next = new Set(selected);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setSelected(next);

        // Convert back to slot array
        const newSlots: AvailabilitySlot[] = [];
        next.forEach(k => {
            const [d, t] = k.split('-');
            const slot = TIME_SLOTS.find(s => s.value === t);
            if (slot) {
                newSlots.push({
                    day_of_week: parseInt(d),
                    start_time: slot.value,
                    end_time: slot.end,
                    is_recurring: true,
                    is_blocked: false,
                });
            }
        });
        onChange(newSlots);
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className="p-2 text-xs font-medium text-gray-500 text-left w-20" />
                        {WEEKDAYS.map(day => (
                            <th key={day} className="p-2 text-xs font-semibold text-gray-700 text-center">
                                {DAYS[day]}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {TIME_SLOTS.map(timeSlot => (
                        <tr key={timeSlot.value}>
                            <td className="p-2 text-xs text-gray-500 whitespace-nowrap">{timeSlot.label}</td>
                            {WEEKDAYS.map(day => {
                                const key = `${day}-${timeSlot.value}`;
                                const isSelected = selected.has(key);
                                return (
                                    <td key={key} className="p-1">
                                        <button
                                            onClick={() => toggle(day, timeSlot)}
                                            disabled={readOnly}
                                            className={`w-full h-10 rounded-lg border transition-all ${
                                                isSelected
                                                    ? 'bg-teal-500 border-teal-600 hover:bg-teal-600'
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                            } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
