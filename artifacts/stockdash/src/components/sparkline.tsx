interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export function Sparkline({ data, width = 200, height = 40, color = "#22c55e", className = "" }: SparklineProps) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  const polygonPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={polygonPoints} fill={`url(#gradient-${color})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  );
}
