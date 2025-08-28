"use client";

import { useState } from 'react';

interface RefreshSettingsProps {
  currentInterval: number; // en millisecondes
  onIntervalChange: (interval: number) => void;
  loading?: boolean;
}

const PRESET_INTERVALS = [
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1min', value: 60000 },
  { label: '5min', value: 300000 },
  { label: 'Manuel', value: 0 },
];

export default function RefreshSettings({ currentInterval, onIntervalChange, loading }: RefreshSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getCurrentLabel = () => {
    const preset = PRESET_INTERVALS.find(p => p.value === currentInterval);
    return preset?.label || `${Math.floor(currentInterval / 1000)}s`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        disabled={loading}
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
        <span>{getCurrentLabel()}</span>
        <svg className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[120px]">
            <div className="py-1">
              {PRESET_INTERVALS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => {
                    onIntervalChange(preset.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 transition-colors ${
                    currentInterval === preset.value ? 'text-blue-600 font-medium' : 'text-gray-700'
                  }`}
                >
                  {preset.label}
                  {preset.value === 0 && (
                    <span className="ml-1 text-[10px] text-gray-400">(Pas de refresh auto)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
