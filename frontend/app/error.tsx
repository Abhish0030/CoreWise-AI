'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="dashboard">
      <section className="panel feature-empty">
        <h1>Workspace couldn’t load.</h1>
        <p>Try again to reload this view.</p>
        <Button onClick={reset}>Try again</Button>
      </section>
    </div>
  );
}
