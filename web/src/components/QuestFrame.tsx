import React from 'react';

type ScreenShellProps = {
  screen: 'menu' | 'playing' | 'victory' | 'vocab-management';
  label: string;
  children: React.ReactNode;
  className?: string;
};

export function ScreenShell({ screen, label, children, className = '' }: ScreenShellProps) {
  return (
    <main aria-label={label} data-screen={screen} className={`eq-screen eq-screen--${screen} ${className}`}>
      {children}
    </main>
  );
}

type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function Panel({ children, className = '' }: PanelProps) {
  return <section className={`eq-panel ${className}`}>{children}</section>;
}

type QuestButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'quiet' | 'gold';
  icon?: React.ReactNode;
};

export function QuestButton({
  variant = 'primary',
  icon,
  children,
  className = '',
  ...props
}: QuestButtonProps) {
  return (
    <button className={`eq-button eq-button--${variant} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'tool' | 'danger' | 'quiet';
};

export function IconButton({ variant = 'tool', children, className = '', ...props }: IconButtonProps) {
  return (
    <button className={`eq-icon-button eq-icon-button--${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

type StatBadgeProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: 'gold' | 'green' | 'blue' | 'red';
};

export function StatBadge({ icon, label, value, tone = 'blue' }: StatBadgeProps) {
  return (
    <div className={`eq-stat eq-stat--${tone}`}>
      <span className="eq-stat__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="eq-stat__label">{label}</span>
      <span className="eq-stat__value">{value}</span>
    </div>
  );
}
