export default function Loading() {
  return (
    <div className="dashboard" role="status">
      <span className="sr-only">Loading workspace</span>
      <div className="skeleton loading-title" />
      <div className="skeleton loading-hero" />
      <div className="metrics-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton loading-metric" />
        ))}
      </div>
    </div>
  );
}
