import { Sparkles } from 'lucide-react';
import Link from 'next/link';

interface LogoProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Text color — use 'light' on dark backgrounds */
  variant?: 'dark' | 'light';
  /** Whether to wrap in a Link to "/" */
  asLink?: boolean;
  /** Extra className on the outer wrapper */
  className?: string;
}

const sizes = {
  sm: { box: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4', text: 'text-base' },
  md: { box: 'w-9 h-9 rounded-xl', icon: 'w-5 h-5', text: 'text-lg' },
  lg: { box: 'w-12 h-12 rounded-xl', icon: 'w-6 h-6', text: 'text-2xl' },
};

export function Logo({
  size = 'md',
  variant = 'dark',
  asLink = true,
  className = '',
}: LogoProps) {
  const s = sizes[size];
  const textColor = variant === 'dark' ? 'text-slate-900' : 'text-white';

  const content = (
    <>
      <div
        className={`${s.box} bg-gradient-to-br from-primary-500 via-primary to-amber-500 flex items-center justify-center shadow-lg shadow-primary/25`}
      >
        <Sparkles className={`${s.icon} text-white`} />
      </div>
      <span className={`${s.text} font-bold ${textColor}`}>Faroway</span>
    </>
  );

  if (asLink) {
    return (
      <Link
        href="/"
        className={`flex items-center gap-2.5 group hover:opacity-90 transition-opacity ${className}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>{content}</div>
  );
}
