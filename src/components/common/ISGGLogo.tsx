import React from 'react';

interface ISGGLogoProps {
  variant?: 'full' | 'horizontal' | 'icon-only';
  theme?: 'light' | 'dark';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const ISGGLogo: React.FC<ISGGLogoProps> = ({
  variant = 'horizontal',
  theme = 'light',
  className = '',
  size = 'md',
}) => {
  const isDark = theme === 'dark';

  // Heights for the actual image file
  const heights = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-24 sm:h-32',
    xl: 'h-36 sm:h-44',
  }[size];

  // 1. FULL LOGO: Display the exact submitted image as-is
  if (variant === 'full') {
    return (
      <div className={`inline-flex flex-col items-center select-none ${className}`}>
        <img
          src="/isgg-logo.png"
          alt="Institut Supérieur de Génie Civil et de Gestion (ISGG)"
          className={`${heights} w-auto object-contain drop-shadow-xs`}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // 2. ICON ONLY: Display the image cleanly sized
  if (variant === 'icon-only') {
    const iconHeights = {
      sm: 'h-8',
      md: 'h-11',
      lg: 'h-14',
      xl: 'h-20',
    }[size];

    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <img
          src="/isgg-logo.png"
          alt="Logo ISGG"
          className={`${iconHeights} w-auto object-contain ${isDark ? 'bg-white/95 p-1 rounded-lg' : ''}`}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // 3. HORIZONTAL: Image alongside institution title
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src="/isgg-logo.png"
        alt="Logo ISGG"
        className={`${heights} w-auto object-contain ${isDark ? 'bg-white/95 p-1 rounded-lg' : ''}`}
        referrerPolicy="no-referrer"
      />
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className={`font-black text-lg tracking-tight ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
            IS<span className="text-[#EA580C]">GG</span>
          </span>
          <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
            isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-orange-100 text-[#EA580C]'
          }`}>
            Officiel
          </span>
        </div>
        <span
          className={`font-bold tracking-wider uppercase leading-tight mt-1 text-[10px] ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          Institut Supérieur de Génie Civil<br />et de Gestion
        </span>
      </div>
    </div>
  );
};
