import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// Top 5 countries with their country codes
const COUNTRIES = [
    { code: '+91', name: 'India', flag: '🇮🇳', digits: 10 },
    { code: '+1', name: 'United States', flag: '🇺🇸', digits: 10 },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧', digits: 10 },
    { code: '+971', name: 'UAE', flag: '🇦🇪', digits: 9 },
    { code: '+65', name: 'Singapore', flag: '🇸🇬', digits: 8 },
];

interface PhoneInputProps {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder?: string;
    className?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
    value,
    onChange,
    error,
    placeholder = 'E.g., 9876543210',
    className = ''
}) => {
    // Parse existing value to extract country code and number
    const parsePhoneValue = (val: string) => {
        const cleanVal = val.trim();
        for (const country of COUNTRIES) {
            if (cleanVal.startsWith(country.code)) {
                return {
                    countryCode: country.code,
                    number: cleanVal.slice(country.code.length).trim()
                };
            }
        }
        // Default to India if no country code found
        return {
            countryCode: '+91',
            number: cleanVal.replace(/^\+?\d{1,4}\s*/, '') // Remove any existing country code
        };
    };

    const { countryCode: initialCode, number: initialNumber } = parsePhoneValue(value);
    const [selectedCountry, setSelectedCountry] = useState(
        COUNTRIES.find(c => c.code === initialCode) || COUNTRIES[0]
    );
    const [phoneNumber, setPhoneNumber] = useState(initialNumber);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Update parent component when country or number changes
    useEffect(() => {
        const fullNumber = phoneNumber ? `${selectedCountry.code} ${phoneNumber}` : '';
        onChange(fullNumber);
    }, [selectedCountry, phoneNumber]);

    const handleCountrySelect = (country: typeof COUNTRIES[0]) => {
        setSelectedCountry(country);
        setIsOpen(false);
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        // Only allow digits
        const digitsOnly = inputValue.replace(/\D/g, '');
        setPhoneNumber(digitsOnly);
    };

    return (
        <div className={className}>
            <div className={`flex items-stretch rounded-xl border ${error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'} overflow-hidden focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-500 transition-all`}>
                {/* Country Code Selector */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-3.5 border-r border-gray-200 hover:bg-gray-50 transition-colors min-w-[90px] sm:min-w-[100px]"
                    >
                        <span className="text-xl">{selectedCountry.flag}</span>
                        <span className="text-sm font-medium text-gray-700">{selectedCountry.code}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                            {COUNTRIES.map((country) => (
                                <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => handleCountrySelect(country)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                                        selectedCountry.code === country.code ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <span className="text-2xl">{country.flag}</span>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-900">{country.name}</div>
                                        <div className="text-xs text-gray-500">{country.code}</div>
                                    </div>
                                    {selectedCountry.code === country.code && (
                                        <span className="text-blue-600 text-sm">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Phone Number Input */}
                <input
                    type="tel"
                    className="flex-1 px-4 py-3.5 text-sm bg-transparent placeholder:text-gray-400 focus:outline-none"
                    placeholder={placeholder}
                    value={phoneNumber}
                    onChange={handleNumberChange}
                    maxLength={selectedCountry.digits}
                />
            </div>

            {/* Error Message */}
            {error && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-2">
                    <span>⚠</span> {error}
                </p>
            )}

            {/* Helper Text */}
            {!error && (
                <p className="text-xs text-gray-500 mt-2">
                    Enter {selectedCountry.digits} digit phone number for {selectedCountry.name}
                </p>
            )}
        </div>
    );
};
