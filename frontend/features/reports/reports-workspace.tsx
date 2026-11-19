'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Printer, Trash2, Eye } from 'lucide-react';
import {
  reportSourcesSchema,
  reportListSchema,
  reportResponseSchema,
  reportPreviewSchema,
  reportInputSchema,
  type ReportInput,
  type ReportSnapshot,
  type CurrentUser,
  type GeneratedReport,
} from '@corewise/types';
import { apiData, apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ReportPreview } from './report-preview';
const initial = {
  title: 'CoreWise performance evidence',
  type: 'OVERVIEW' as const,
  workloadIds: [],
  comparisonIds: [],
  predictionIds: [],
  benchmarkIds: [],
  explanationIds: [],
};
export function ReportsWorkspace({ user }: { user: CurrentUser }) {
  const client = useQueryClient(),
    dialog = useRef<HTMLDialogElement>(null);
  const sources = useQuery({
    queryKey: ['report-sources', user.id],
    queryFn: () => apiData('/api/reports/sources', reportSourcesSchema),
  });
  const history = useQuery({
    queryKey: ['report-history', user.id],
    queryFn: () => apiData('/api/reports', reportListSchema),
  });
  const [input, setInput] = useState<ReportInput>(initial),
    [preview, setPreview] = useState<ReportSnapshot | null>(null),
    [saved, setSaved] = useState<GeneratedReport | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState<string | null>(null);
  function change(next: ReportInput) {
    setInput(next);
    setPreview(null);
    setSaved(null);
    setError('');
  }
  async function build(generate: boolean) {
    setError('');
    const parsed = reportInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Select valid source records.');
      return;
    }
    setBusy(true);
    try {
      if (generate) {
        const r = await apiData('/api/reports', reportResponseSchema, {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
        setSaved(r.data);
        setPreview(r.data.snapshot);
        await Promise.all([
          client.invalidateQueries({ queryKey: ['report-history', user.id] }),
          client.invalidateQueries({ queryKey: ['workspace-summary', user.id] }),
        ]);
      } else {
        const r = await apiData('/api/reports/preview', reportPreviewSchema, {
          method: 'POST',
          body: JSON.stringify(parsed.data),
        });
        setPreview(r.data);
        setSaved(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the report.');
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    setBusy(true);
    setError('');
    try {
      const r = await apiData(`/api/reports/${encodeURIComponent(id)}`, reportResponseSchema);
      setSaved(r.data);
      setPreview(r.data.snapshot);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Report unavailable.');
    } finally {
      setBusy(false);
    }
  }
  async function download(format: 'pdf' | 'csv') {
    if (!saved) return;
    setError('');
    try {
      const r = await fetch(
        `/api/reports/${encodeURIComponent(saved.id)}/download?format=${format}`,
        { credentials: 'same-origin', cache: 'no-store' },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw Error(body?.error?.message ?? 'Download failed.');
      }
      const blob = await r.blob(),
        url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `corewise-${saved.id}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    }
  }
  async function remove() {
    if (!deleting) return;
    try {
      await apiRequest(`/api/reports/${encodeURIComponent(deleting)}`, { method: 'DELETE' });
      if (saved?.id === deleting) {
        setSaved(null);
        setPreview(null);
      }
      setDeleting(null);
      dialog.current?.close();
      await client.invalidateQueries({ queryKey: ['report-history', user.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deletion failed.');
    }
  }
  function printReport() {
    const details = [...document.querySelectorAll<HTMLDetailsElement>('.report-preview details')];
    const prior = details.map((d) => d.open);
    details.forEach((d) => {
      d.open = true;
    });
    window.addEventListener(
      'afterprint',
      () =>
        details.forEach((d, i) => {
          d.open = prior[i] ?? false;
        }),
      { once: true },
    );
    window.print();
  }
  const groups = [
    ['workloads', 'workloadIds', 'Workloads'],
    ['comparisons', 'comparisonIds', 'Analytical comparisons'],
    ['predictions', 'predictionIds', 'ML predictions'],
    ['benchmarks', 'benchmarkIds', 'Measured benchmark runs'],
    ['explanations', 'explanationIds', 'Completed SHAP explanations'],
  ] as const;
  return (
    <div className="dashboard reports-workspace">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXPORT EVIDENCE, PRESERVE ITS SOURCE</div>
          <h1>
            Reports<span className="title-dot">.</span>
          </h1>
          <p>Build reproducible reports from your own saved records.</p>
        </div>
        <span className="badge">M7 · IMMUTABLE SNAPSHOTS</span>
      </div>
      <p className="notice">
        Measured runs, analytical estimates, ML predictions and SHAP stay distinct. Empty sections
        are not filled with invented results.
      </p>
      <div className="report-builder-grid">
        <section className="panel report-builder" aria-label="Report builder">
          <div className="section-heading">
            <h2>Build your report</h2>
            <FileText size={20} />
          </div>
          <div className="field">
            <label htmlFor="report-title">Report title</label>
            <input
              id="report-title"
              maxLength={120}
              value={input.title}
              onChange={(e) => change({ ...input, title: e.target.value })}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="report-type">Report type</label>
              <select
                id="report-type"
                value={input.type}
                onChange={(e) => change({ ...input, type: e.target.value as ReportInput['type'] })}
              >
                {[
                  'OVERVIEW',
                  'HARDWARE',
                  'WORKLOAD',
                  'ANALYTICAL',
                  'ML_PREDICTION',
                  'BENCHMARK',
                  'EXPLAINABILITY',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="report-hardware">Hardware profile (optional)</label>
              <select
                id="report-hardware"
                value={input.hardwareProfileId ?? ''}
                onChange={(e) => {
                  const next = { ...input };
                  if (e.target.value) next.hardwareProfileId = e.target.value;
                  else delete next.hardwareProfileId;
                  change(next);
                }}
              >
                <option value="">No separate profile section</option>
                {sources.data?.data.hardware.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {sources.isPending ? (
            <div
              role="status"
              className="skeleton comparison-loading"
              aria-label="Loading report sources"
            />
          ) : sources.isError ? (
            <p className="form-error" role="alert">
              Source records are unavailable.{' '}
              <button onClick={() => void sources.refetch()}>Retry sources</button>
            </p>
          ) : (
            <div className="report-source-groups">
              {groups.map(([key, field, label]) => (
                <fieldset key={key}>
                  <legend>{label}</legend>
                  {sources.data.data[key].length ? (
                    sources.data.data[key].map((r) => (
                      <label className="report-source-option" key={r.id}>
                        <input
                          type="checkbox"
                          checked={input[field].includes(r.id)}
                          onChange={(e) =>
                            change({
                              ...input,
                              [field]: e.target.checked
                                ? [...input[field], r.id]
                                : input[field].filter((id) => id !== r.id),
                            })
                          }
                        />
                        <span>{r.label}</span>
                      </label>
                    ))
                  ) : (
                    <p className="muted">No saved {label.toLowerCase()} available.</p>
                  )}
                </fieldset>
              ))}
            </div>
          )}
          <p className="muted">
            Select 1–12 sources, up to six per group. Saved comparison/prediction hardware snapshots
            are retained independently of the optional profile above.
          </p>
          <div className="report-actions">
            <Button
              variant="outline"
              disabled={busy || !sources.isSuccess}
              onClick={() => void build(false)}
            >
              <Eye size={15} /> Preview report
            </Button>
            <Button disabled={busy || !sources.isSuccess} onClick={() => void build(true)}>
              {busy ? 'Building…' : 'Generate report'}
            </Button>
          </div>
        </section>
        <aside className="panel report-history" aria-label="Report history">
          <h2>Report history</h2>
          {history.isPending ? (
            <div className="skeleton explanation-loading" />
          ) : history.isError ? (
            <p role="alert">Could not load history.</p>
          ) : !history.data.data.length ? (
            <p className="muted">No generated reports yet.</p>
          ) : (
            history.data.data.map((r) => (
              <div className="report-history-row" key={r.id}>
                <div className="report-history-description">
                  <button
                    className="report-history-open"
                    aria-label={`Open report ${r.title}`}
                    onClick={() => void open(r.id)}
                    disabled={busy}
                  >
                    <strong>{r.title}</strong>
                  </button>
                  <small>
                    {r.type} · {r.sourceCount} sources · {new Date(r.createdAt).toLocaleString()}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Delete report ${r.title}`}
                  onClick={() => {
                    setDeleting(r.id);
                    dialog.current?.showModal();
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </aside>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <div role="status" className="skeleton comparison-loading" aria-label="Building report" />
      )}
      {preview && (
        <section className="report-result" data-testid="report-result">
          <div className="report-actions report-export-actions">
            <span className="badge">{saved ? 'SAVED · IMMUTABLE' : 'PREVIEW · NOT SAVED'}</span>
            {saved && (
              <>
                <Button variant="outline" onClick={() => void download('pdf')}>
                  <Download size={15} /> Download PDF
                </Button>
                <Button variant="outline" onClick={() => void download('csv')}>
                  <Download size={15} /> Download CSV
                </Button>
              </>
            )}
            <Button variant="outline" onClick={printReport}>
              <Printer size={15} /> Print report
            </Button>
          </div>
          <ReportPreview snapshot={preview} />
          {saved && (
            <p className="muted">
              Export version {saved.exportMetadata.version} · PDF{' '}
              {saved.exportMetadata.pdfBytes.toLocaleString()} bytes · CSV{' '}
              {saved.exportMetadata.csvBytes.toLocaleString()} bytes
            </p>
          )}
        </section>
      )}
      <dialog ref={dialog} className="profile-dialog" onCancel={() => setDeleting(null)}>
        <h2>Delete generated report?</h2>
        <p>This removes the saved snapshot and its exports. Source records are retained.</p>
        <div className="dialog-actions">
          <Button
            variant="outline"
            onClick={() => {
              setDeleting(null);
              dialog.current?.close();
            }}
          >
            Cancel
          </Button>
          <Button onClick={() => void remove()}>Delete report</Button>
        </div>
      </dialog>
    </div>
  );
}
