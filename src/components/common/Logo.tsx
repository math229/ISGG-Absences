import React from 'react';
import { ISGGLogo } from './ISGGLogo';

interface LogoProps {
  variant?: 'light' | 'dark' | 'icon-only' | 'full';
  theme?: 'light' | 'dark';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ 
  variant = 'dark', 
  theme, 
  className = '', 
  size = 'md' 
}) => {
  // Dashboard & Sidebar use variant="light" (or theme="dark"): Revert to original ISGGLogo
  if (variant === 'light' || theme === 'dark') {
    return (
      <ISGGLogo 
        variant={variant === 'icon-only' ? 'icon-only' : 'horizontal'} 
        theme="dark" 
        className={className} 
        size={size} 
      />
    );
  }

  // Full official logo image
  if (variant === 'full') {
    return (
      <div className={`inline-flex flex-col items-center select-none ${className}`}>
        <img
          src="/isgg-logo.png"
          alt="Institut Supérieur de Génie Civil et de Gestion"
          className={`${size === 'lg' ? 'h-24' : 'h-16'} w-auto object-contain`}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Emblem icon only
  if (variant === 'icon-only') {
    const iconHeight = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-11' : 'h-9';
    return (
      <div className={`inline-flex items-center justify-center select-none ${className}`}>
        <img
          src="/isgg-emblem.png"
          alt="ISGG"
          className={`${iconHeight} w-auto object-contain`}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Login page layout (variant="dark"): Validated layout with official ISGG emblem
  const iconHeight = size === 'sm' ? 'h-7' : size === 'lg' ? 'h-11' : 'h-9';
  const titleSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';
  const subtitleSize = size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-[10px]' : 'text-[9px]';

  return (
    <div className={`flex items-center gap-3.5 select-none ${className}`}>
      {/* Official ISGG Emblem Icon */}
      <img
        src="/isgg-emblem.png"
        alt="Logo Officiel ISGG"
        className={`${iconHeight} w-auto object-contain flex-shrink-0 transition-transform duration-200 hover:scale-105`}
        referrerPolicy="no-referrer"
      />

      {/* Typography: ISGG + Institut Supérieur de Génie Civil et de Gestion */}
      <div className="flex flex-col justify-center">
        <span className={`font-black tracking-tight leading-none ${titleSize} text-[#0F172A]`}>
          ISGG
        </span>
        <span className={`font-bold tracking-wider uppercase leading-tight mt-1 ${subtitleSize} text-slate-600`}>
          Institut Supérieur de Génie Civil<br />et de Gestion
        </span>
      </div>
    </div>
  );
};

export const ArchitecturalFooterEmblem: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-4 border-t border-slate-800/80 text-center">
      <div className="mb-2 opacity-80">
        <ISGGLogo variant="icon-only" theme="dark" size="sm" />
      </div>
      <p className="text-[11px] font-medium text-slate-400 tracking-wide">
        Former aujourd&apos;hui<br />
        <span className="text-orange-400 font-semibold">les leaders de demain</span>
      </p>
    </div>
  );
};
