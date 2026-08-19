import React from 'react';
import { TimeInput12h } from './TimeInput12h';
import { combineDateAnd12hTime, splitDateAnd12hTime } from '../../utils/date';

interface DateTimeInput12hProps {
  label: string;
  isoValue: string; // ISO string or datetime
  onChange: (isoValue: string) => void;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  className?: string;
}

export const DateTimeInput12h: React.FC<DateTimeInput12hProps> = ({
  label,
  isoValue,
  onChange,
  disabled = false,
  required = false,
  helperText,
  className = '',
}) => {
  const { date, time12h } = splitDateAnd12hTime(isoValue);

  const handleDateChange = (newDate: string) => {
    const combined = combineDateAnd12hTime(newDate, time12h);
    onChange(combined);
  };

  const handleTimeChange = (newTime: string) => {
    const combined = combineDateAnd12hTime(date, newTime);
    onChange(combined);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-xs font-semibold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <input
            type="date"
            disabled={disabled}
            required={required}
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full h-[38px] rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-900 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none shadow-2xs cursor-pointer"
          />
        </div>
        <div>
          <TimeInput12h
            value={time12h}
            onChange={handleTimeChange}
            disabled={disabled}
            required={required}
          />
        </div>
      </div>

      {helperText && <p className="text-[11px] text-gray-500">{helperText}</p>}
    </div>
  );
};
