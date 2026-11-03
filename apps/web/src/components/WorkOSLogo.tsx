import React from 'react';

interface WorkOSLogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
}

export const WorkOSLogo: React.FC<WorkOSLogoProps> = ({
  className = '',
  iconOnly = false,
  size = 'md',
  theme = 'dark',
}) => {
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  };

  const textSizes = {
    sm: 'text-base font-bold tracking-tight',
    md: 'text-xl font-bold tracking-tight',
    lg: 'text-2xl font-bold tracking-tight',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* WorkOS Delta Icon */}
      <div
        className={`${iconSizes[size]} bg-white rounded-lg p-1.5 flex items-center justify-center shadow-sm shrink-0`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full text-slate-950"
        >
          <path d="M12 3L2 21h20L12 3z" />
        </svg>
      </div>

      {!iconOnly && (
        <span
          className={`${textSizes[size]} ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}
        >
          WorkOS
        </span>
      )}
    </div>
  );
};
