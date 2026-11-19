export function formatTime(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '—';
  const ms = seconds * 1000;
  if (ms === 0) return '0 ms';
  return ms < 0.001 || ms >= 1e9
    ? `${ms.toExponential(3)} ms`
    : `${ms.toLocaleString('en-GB', { maximumFractionDigits: 4 })} ms`;
}
