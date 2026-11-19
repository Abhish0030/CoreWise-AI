import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="dashboard">
      <section className="panel feature-empty">
        <span className="eyebrow">404 · PAGE NOT FOUND</span>
        <h1>This page isn’t in your workspace.</h1>
        <Link className="button button-primary" href="/">
          Back to overview
        </Link>
      </section>
    </div>
  );
}
