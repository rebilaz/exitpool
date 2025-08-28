"use client";
import React from 'react';

const ranges = ['1D','1W','1M','YTD','1Y'] as const;
export type TimeRange = typeof ranges[number];

interface TimeRangeTabsProps {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
  className?: string;
}

export const TimeRangeTabs: React.FC<TimeRangeTabsProps> = ({ value, onChange, className }) => {
  return (
    <div className={"flex items-center gap-1 " + (className ?? '')}>
      {ranges.map(r => {
        const active = r === value;
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={`relative rounded-full px-3 py-1 text-[11px] font-medium transition-colors border ${active ? 'bg-gray-900 text-white border-gray-900 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
};

export default TimeRangeTabs;
