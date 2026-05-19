'use client';

import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  gold: 'bg-gold hover:bg-gold-light text-felt-dark font-bold border border-gold-dark shadow-md hover:shadow-gold/40 transition-all',
  ghost: 'bg-transparent border border-gold/40 text-gold hover:bg-gold/10 transition-all',
  danger: 'bg-red-700 hover:bg-red-600 text-white border border-red-500 transition-all',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-8 py-3.5 text-lg',
};

export default function Button({
  variant = 'gold',
  size = 'md',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`
        rounded-md font-display tracking-wide
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
