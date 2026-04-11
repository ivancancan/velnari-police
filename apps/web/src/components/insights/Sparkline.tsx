interface Props {
  values: number[];
  color: string;
  height?: number;
}

export default function Sparkline({ values, color, height = 28 }: Props) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-300"
          style={{
            height: `${Math.max((v / max) * 100, 4)}%`,
            backgroundColor: i === values.length - 1 ? color : `${color}55`,
          }}
        />
      ))}
    </div>
  );
}
