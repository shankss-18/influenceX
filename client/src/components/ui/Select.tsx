import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, id, className = '', disabled, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative rounded-lg">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`appearance-none block w-full rounded-lg border bg-white text-gray-900 text-sm py-2 pl-3.5 pr-10 transition-colors
              focus:outline-none focus:ring-1
              ${
                error
                  ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-brand-600 focus:ring-brand-600'
              }
              ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-200' : ''}
              ${className}`}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error ? (
          <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
