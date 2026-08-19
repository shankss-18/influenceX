import React from 'react';

export interface BadgeProps {
  variant?: 'gray' | 'green' | 'red' | 'amber' | 'brand';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'gray',
  size = 'md',
  dot = false,
  children,
  className = '',
}) => {
  const variants = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
  };

  const dotVariants = {
    gray: 'bg-gray-500',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    brand: 'bg-brand-600',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotVariants[variant]}`} />}
      {children}
    </span>
  );
};
