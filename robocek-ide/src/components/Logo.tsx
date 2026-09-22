import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  iconOnly?: boolean;
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_MAP = {
  sm: { height: 24, fontSize: 14 },
  md: { height: 36, fontSize: 18 },
  lg: { height: 60, fontSize: 24 },
  xl: { height: 90, fontSize: 32 },
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  iconOnly = false,
  glow = true,
  className = '',
  style = {},
}) => {
  const dimensions = SIZE_MAP[size];

  return (
    <div
      className={`logo-container ${glow ? 'logo-glow' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        userSelect: 'none',
        ...style,
      }}
    >
      <img
        src="/logo.png"
        alt="ROBOCEK Studio Logo"
        style={{
          height: dimensions.height,
          width: 'auto',
          objectFit: 'contain',
          filter: glow
            ? 'drop-shadow(0 0 12px rgba(0, 200, 255, 0.4)) brightness(1.1)'
            : 'brightness(1.05)',
          mixBlendMode: 'screen',
          transition: 'all 0.3s ease',
        }}
      />
      {!iconOnly && (
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontSize: dimensions.fontSize,
            background: 'linear-gradient(135deg, #FFFFFF 0%, #E2E8F4 50%, var(--accent) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase',
            display: 'none', // Note: The image already contains "STUDIO", so iconOnly is implicit if using full image
          }}
        >
          ROBOCEK
        </span>
      )}
    </div>
  );
};
