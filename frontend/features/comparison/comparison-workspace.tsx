'use client';
import Link from 'next/link';
import { useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  analyticalRequestSchema,
  emptyCapabilities,
  hardwareListSchema,
  workloadListSchema,
  comparisonListSchema,
  comparisonResponseSchema,
  type CurrentUser,
  type z,
} from '@corewise/types';
import { ArrowLeftRight, Play, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiData } from '@/lib/api';
import { useAuth } from '@/features/auth/use-auth';
import { CapabilityFields } from '@/features/workloads/capability-fields';
import { ComparisonResultView } from './result-view';
import { PredictionPlayground } from '@/features/ml/prediction-playground';

type RunInput = z.infer<typeof analyticalRequestSchema>;
export function ComparisonWorkspace({
  user,
  initialId,
}: {
  user: CurrentUser;
  initialId?: string;
}) {
  const auth = useAuth(user);
  const client = useQueryClient();
  const [shown, setShown] = useState<string | null | undefined>(initialId);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'ANALYTICAL' | 'ML'>('ANALYTICAL');
  const workloads = useQuery({
    queryKey: ['workloads', user.id],
    queryFn: () => apiData('/api/workloads', workloadListSchema),
  });
  const hardware = useQuery({
    queryKey: ['hardware-profiles', user.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
  });
  const history = useQuery({
    queryKey: ['comparisons', user.id],
    queryFn: () => apiData('/api/comparisons', comparisonListSchema),
  });
  const shownId = shown === undefined ? history.data?.data[0]?.id : shown;
  const record = useQuery({
    queryKey: ['comparison', shownId],
    queryFn: () =>
      apiData(`/api/comparisons/${encodeURIComponent(shownId!)}`, comparisonResponseSchema),
    enabled: !!shownId,
    retry: false,
  });
  const form = useForm<RunInput>({
    resolver: zodResolver(analyticalRequestSchema),
    defaultValues: {
      workloadId: '',
      hardwareProfileId: user.selectedProfileId ?? user.defaultProfileId ?? undefined,
      assumptions: { ...emptyCapabilities },
      tolerance: 0.05,
    },
  });
  const {
    register,
    reset,
    setValue,
    handleSubmit,
    setError,
    formState: { errors },
  } = form;
  const values = useWatch({ control: form.control }) as RunInput;
  const selected = hardware.data?.data.find((profile) => profile.id === values.hardwareProfileId);
  async function compare(value: RunInput) {
    setBusy(true);
    try {
      const response = await apiData('/api/analytical/compare', comparisonResponseSchema, {
        method: 'POST',
        body: JSON.stringify(value),
      });
      client.setQueryData(['comparison', response.data.id], response);
      setShown(response.data.id);
      await client.invalidateQueries({ queryKey: ['comparisons'] });
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Comparison failed.' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="dashboard comparison-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVIDENCE BEFORE ACCELERATION</div>
          <h1>
            CPU vs GPU<span className="title-dot">.</span>
          </h1>
          <p>Compare compute, memory, and data movement under explicit assumptions.</p>
        </div>
        <span className="badge analytical-badge">
          {mode === 'ANALYTICAL' ? 'ANALYTICAL ESTIMATE' : 'ML PREDICTION · PREDICTED'}
        </span>
      </div>
      <div className="ml-mode-switch" role="group" aria-label="Comparison method">
        <Button
          variant={mode === 'ANALYTICAL' ? 'default' : 'outline'}
          onClick={() => setMode('ANALYTICAL')}
        >
          Analytical Estimate
        </Button>
        <Button variant={mode === 'ML' ? 'default' : 'outline'} onClick={() => setMode('ML')}>
          ML Prediction
        </Button>
      </div>
      {mode === 'ML' ? (
        <PredictionPlayground user={user} />
      ) : (
        <>
          <FormProvider {...form}>
            <form className="panel compare-controls" onSubmit={handleSubmit(compare)} noValidate>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="compare-workload">Saved workload</label>
                  <select
                    id="compare-workload"
                    {...register('workloadId')}
                    onChange={(e) => {
                      const workload = workloads.data?.data.find(
                        (item) => item.id === e.target.value,
                      );
                      if (workload)
                        reset({
                          workloadId: workload.id,
                          hardwareProfileId:
                            workload.hardwareProfileId ??
                            auth.data?.selectedProfileId ??
                            auth.data?.defaultProfileId ??
                            undefined,
                          assumptions: workload.assumptions,
                          tolerance: workload.tolerance,
                        });
                      else setValue('workloadId', '');
                      setShown(null);
                    }}
                  >
                    <option value="">Choose a saved workload…</option>
                    {workloads.data?.data.map((workload) => (
                      <option key={workload.id} value={workload.id}>
                        {workload.name}
                      </option>
                    ))}
                  </select>
                  {errors.workloadId && (
                    <small className="field-error">Select a saved workload.</small>
                  )}
                </div>
                <div className="field">
                  <label htmlFor="compare-hardware">Hardware profile for this run</label>
                  <select
                    id="compare-hardware"
                    value={values.hardwareProfileId ?? ''}
                    onChange={(e) => {
                      setValue('hardwareProfileId', e.target.value || undefined);
                      setValue('assumptions', {
                        ...emptyCapabilities,
                        precision: values.assumptions.precision,
                      });
                      setShown(null);
                    }}
                  >
                    <option value="">Use workload / selected / default profile</option>
                    {hardware.data?.data.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                        {profile.id === auth.data?.defaultProfileId ? ' · Default' : ''}
                      </option>
                    ))}
                  </select>
                  <small>
                    {selected
                      ? `${selected.cpuName} · ${selected.gpuName ?? 'GPU unknown'} · USER_ENTERED`
                      : 'A saved, owned hardware profile is required. No capabilities are invented.'}
                  </small>
                </div>
              </div>
              <details className="assumptions-section">
                <summary>Review performance assumptions before comparing</summary>
                <CapabilityFields hardware={selected} />
              </details>
              {(workloads.isError || hardware.isError) && (
                <div className="form-error" role="alert">
                  Couldn’t load saved configurations. Reload this page to retry.
                </div>
              )}
              {errors.root && (
                <div className="form-error" role="alert">
                  {errors.root.message}
                </div>
              )}
              <div className="compare-action-row">
                <Button disabled={busy}>
                  <Play size={15} />
                  {busy ? 'Comparing…' : 'Compare devices'}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/workload-analyzer">
                    <Workflow size={15} />
                    Configure workloads
                  </Link>
                </Button>
                <p>
                  New runs save an immutable snapshot. Editing a workload never changes past
                  results.
                </p>
              </div>
            </form>
          </FormProvider>
          <div className="comparison-history">
            <label htmlFor="comparison-history">Saved comparisons</label>
            <select
              id="comparison-history"
              value={shownId ?? ''}
              onChange={(e) => setShown(e.target.value || null)}
            >
              <option value="">Choose a result…</option>
              {history.data?.data.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.workloadSnapshot.name} ·{' '}
                  {new Date(item.createdAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
                </option>
              ))}
            </select>
          </div>
          {history.isPending && !shownId ? (
            <div
              role="status"
              className="skeleton comparison-loading"
              aria-label="Loading comparison history"
            />
          ) : history.isError ? (
            <section className="panel library-empty">
              <h2>Couldn’t load comparison history.</h2>
              <Button variant="outline" onClick={() => void history.refetch()}>
                Retry
              </Button>
            </section>
          ) : record.isError ? (
            <section className="panel library-empty">
              <h2>Comparison unavailable</h2>
              <p>{record.error.message}</p>
            </section>
          ) : shownId && record.isPending ? (
            <div
              role="status"
              className="skeleton comparison-loading"
              aria-label="Loading analytical comparison"
            />
          ) : record.data ? (
            <ComparisonResultView comparison={record.data.data} />
          ) : (
            <section className="panel library-empty">
              <span className="feature-icon">
                <ArrowLeftRight size={34} />
              </span>
              <h2>No analytical comparison yet.</h2>
              <p>
                Save a workload, supply the missing performance capabilities, and compare both
                devices. Estimates include transfer costs and can favor either processor.
              </p>
              <Button asChild variant="outline">
                <Link href="/workload-analyzer">Open workload analyzer</Link>
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
