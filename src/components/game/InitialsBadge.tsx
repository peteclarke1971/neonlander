import React from "react";

interface Props {
  initials: string;
  size?: number; // pixel height
}

export const InitialsBadge: React.FC<Props> = ({ initials, size = 28 }) => {
  const text = (initials || "").toUpperCase().slice(0, 3).padEnd(3, "·");
  const width = size * 3.2;
  const height = size * 1.4;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Initials ${text}`}
    >
      <defs>
        <linearGradient id="neonGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(var(--neon))`} stopOpacity={0.9} />
          <stop offset="100%" stopColor={`hsl(var(--neon))`} stopOpacity={0.6} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x={2} y={2} rx={8} ry={8} width={width - 4} height={height - 4} fill="transparent" stroke={`hsl(var(--neon))`} strokeOpacity={0.5} />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
        fontSize={size}
        fill="none"
        stroke="url(#neonGrad)"
        strokeWidth={1.8}
        filter="url(#glow)"
      >
        {text}
      </text>
    </svg>
  );
};
