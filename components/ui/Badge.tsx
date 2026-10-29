import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'xs' | 'sm' | 'md';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  children,
  icon,
  className = '',
}) => {
  const baseStyles = "inline-flex items-center font-black uppercase tracking-tighter border rounded-lg whitespace-nowrap";
  
  const variants = {
    default: "bg-gray-100 text-gray-500 border-gray-200",
    primary: "bg-primary-50 text-primary-600 border-primary-100",
    success: "bg-success-50 text-success-700 border-success-100",
    warning: "bg-warning-50 text-warning-700 border-warning-100",
    error: "bg-red-50 text-red-700 border-red-100",
    info: "bg-blue-50 text-blue-700 border-blue-100",
  };

  const sizes = {
    xs: "px-1.5 py-0.5 text-[12px] gap-1",
    sm: "px-2.5 py-1 text-[12px] gap-1.5",
    md: "px-4 py-1.5 text-xs gap-2",
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon}
      {children}
    </span>
  );
};