'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-gold text-sm mb-1 font-display">{label}</label>
        )}
        <input
          ref={ref}
          {...props}
          className={`
            w-full bg-felt-dark border border-gold/40 text-white placeholder-white/30
            rounded-md px-4 py-2.5 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30
            transition-all font-mono
            ${error ? 'border-red-500' : ''}
            ${className}
          `}
        />
        {error && <p className="mt-1 text-red-400 text-xs">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

export default Input;
