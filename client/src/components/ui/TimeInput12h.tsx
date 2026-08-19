import React from 'react';

interface TimeInput12hProps {
  label?: string;
  value: string; // e.g. "06:00 PM"
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const TimeInput12h: React.FC<TimeInput12hProps> = ({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
}) => {
  // Parse value or default to 10:00 AM
  const match = (value || '10:00 AM').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const hour = match ? match[1].padStart(2, '0') : '10';
  const minute = match ? match[2] : '00';
  const period = match ? match[3].toUpperCase() : 'AM';

  const updateTime = (newHour: string, newMinute: string, newPeriod: string) => {
    onChange(`${newHour.padStart(2, '0')}:${newMinute.padStart(2, '0')} ${newPeriod}`);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="flex items-center gap-1.5 p-1 bg-white rounded-lg border border-gray-300 focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500 shadow-2xs">
        {/* Hour Dropdown */}
        <select
          aria-label="Hour"
          disabled={disabled}
          value={hour}
          onChange={(e) => updateTime(e.target.value, minute, period)}
          className="bg-transparent text-xs font-semibold text-gray-900 px-2 py-1.5 rounded outline-none cursor-pointer hover:bg-gray-50 border-none"
        >
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span className="text-gray-400 font-bold text-xs">:</span>

        {/* Minute Dropdown */}
        <select
          aria-label="Minute"
          disabled={disabled}
          value={minute}
          onChange={(e) => updateTime(hour, e.target.value, period)}
          className="bg-transparent text-xs font-semibold text-gray-900 px-2 py-1.5 rounded outline-none cursor-pointer hover:bg-gray-50 border-none"
        >
          {[
            '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55',
          ].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* AM / PM Toggle Pills */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-md ml-auto">
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateTime(hour, minute, 'AM')}
            className={`px-2 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
              period === 'AM'
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateTime(hour, minute, 'PM')}
            className={`px-2 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
              period === 'PM'
                ? 'bg-brand-600 text-white shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
};
