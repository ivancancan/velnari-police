export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return (
    <div className={`${px} border-2 border-slate-700 border-t-tactical-blue rounded-full animate-spin`} />
  );
}
