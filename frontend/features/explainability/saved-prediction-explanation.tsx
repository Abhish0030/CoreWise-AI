'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { explanationListSchema, explanationResponseSchema } from '@corewise/types';
import { apiData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { DeviceExplanation } from './explanation-views';
export function SavedPredictionExplanation({
  userId,
  predictionId,
}: {
  userId: string;
  predictionId: string;
}) {
  const client = useQueryClient();
  const [backgroundLimit, setBackgroundLimit] = useState(32),
    [requested, setRequested] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const history = useQuery({
    queryKey: ['prediction-explanations', userId, predictionId],
    queryFn: () =>
      apiData(
        `/api/explanations/prediction/${encodeURIComponent(predictionId)}`,
        explanationListSchema,
      ),
  });
  const id = requested ?? history.data?.data[0]?.id;
  const record = useQuery({
    queryKey: ['explanation', userId, id],
    queryFn: () =>
      apiData(`/api/explanations/${encodeURIComponent(id!)}`, explanationResponseSchema),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data && ['QUEUED', 'RUNNING'].includes(q.state.data.data.status) ? 1500 : false,
  });
  async function explain() {
    setBusy(true);
    setError('');
    try {
      if (!Number.isInteger(backgroundLimit) || backgroundLimit < 8 || backgroundLimit > 128)
        throw Error('Use 8–128 background samples.');
      const r = await apiData('/api/explanations', explanationResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ kind: 'LOCAL', predictionId, backgroundLimit }),
      });
      client.setQueryData(['explanation', userId, r.data.id], r);
      setRequested(r.data.id);
      await client.invalidateQueries({
        queryKey: ['prediction-explanations', userId, predictionId],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Explanation unavailable.');
    } finally {
      setBusy(false);
    }
  }
  const d = record.data?.data;
  return (
    <div className="saved-explanation">
      <section className="panel">
        <span className="eyebrow">SHAP · EXACT SAVED MODEL VERSIONS</span>
        <h2>Explain this prediction</h2>
        <p className="muted">
          CPU and GPU are explained separately using their own training backgrounds. Contributions
          are log-time, not milliseconds or measured timings. Inactive historical model versions can
          still be explained.
        </p>
        <div className="explanation-action">
          <div className="field">
            <label htmlFor={`local-background-${predictionId}`}>
              Local background sample limit
            </label>
            <input
              id={`local-background-${predictionId}`}
              type="number"
              min={8}
              max={128}
              value={backgroundLimit}
              onChange={(e) => setBackgroundLimit(Number(e.target.value))}
            />
          </div>
          <Button
            disabled={busy || (!!d && ['QUEUED', 'RUNNING'].includes(d.status))}
            onClick={() => void explain()}
          >
            {busy ? 'Submitting…' : 'Explain saved prediction'}
          </Button>
        </div>
        {(error || history.isError || record.isError) && (
          <p className="form-error" role="alert">
            {error || history.error?.message || record.error?.message}
          </p>
        )}
        {d && (
          <p className="muted">
            Explanation job: <strong>{d.status}</strong> · attempt {d.attempts}
          </p>
        )}
        {d?.error && (
          <p className="form-error" role="alert">
            {d.error}
          </p>
        )}
        {d && ['QUEUED', 'RUNNING'].includes(d.status) && (
          <div
            role="status"
            className="skeleton explanation-loading"
            aria-label="Computing SHAP explanations"
          />
        )}
        {!d && !history.isPending && (
          <p className="muted">No SHAP explanation saved for this prediction.</p>
        )}
      </section>
      {d?.result?.kind === 'LOCAL' && (
        <>
          <DeviceExplanation data={d.result.models.CPU} />
          <DeviceExplanation data={d.result.models.GPU} />
        </>
      )}
    </div>
  );
}
