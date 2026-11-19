'use client';
import {
  z,
  hardwareSchema,
  predictionResultSchema,
  analyticalResultSchema,
  explanationResultSchema,
  optimizationResponseSchema,
} from '@corewise/types';
export function EvidenceSummary({ data }: { data: unknown }) {
  const optimization = optimizationResponseSchema.shape.data.safeParse(data);
  if (optimization.success) {
    const r = optimization.data;
    return (
      <div className="assistant-evidence">
        <div>
          Processor decision<strong>{r.recommendation.recommendation}</strong>
          <small>
            {r.recommendation.basis} ·{' '}
            {r.recommendation.validated
              ? 'Compatible measurement'
              : 'Estimate; not measured validation'}
          </small>
        </div>
        <div>
          CPU / GPU time
          <strong>
            {r.recommendation.cpuMs?.toPrecision(4) ?? 'Unknown'} /{' '}
            {r.recommendation.gpuMs?.toPrecision(4) ?? 'Unknown'} ms
          </strong>
          <small>CPU/GPU ratio {r.recommendation.speedup?.toPrecision(4) ?? 'Unavailable'}×</small>
        </div>
        {r.comparison && (
          <div>
            Measured CPU / GPU
            <strong>
              {r.comparison.cpuMeasuredMs.toPrecision(4)} /{' '}
              {r.comparison.gpuMeasuredMs.toPrecision(4)} ms
            </strong>
            <small>
              Signed prediction errors {r.comparison.cpuErrorPercent?.toFixed(2) ?? 'Unknown'}% /{' '}
              {r.comparison.gpuErrorPercent?.toFixed(2) ?? 'Unknown'}%
            </small>
          </div>
        )}
        <div>
          Uncertainty
          <p>
            Point estimates only; no statistical confidence interval is supplied. Review model
            evaluation and source limitations.
          </p>
        </div>
      </div>
    );
  }
  const hardware = z.array(hardwareSchema).safeParse(data);
  if (hardware.success && hardware.data.length)
    return (
      <div className="assistant-evidence">
        {hardware.data.map((h) => (
          <div key={h.id}>
            {h.name}
            <strong>{h.cpuName}</strong>
            <p>
              {h.gpuName ?? 'GPU unknown'} · {h.ramGb} GiB RAM
            </p>
            <small>
              {h.provenance} ·{' '}
              {h.provenance === 'MEASURED'
                ? 'runner-reported detection'
                : 'unverified specifications'}
            </small>
          </div>
        ))}
      </div>
    );
  const nested = z.object({ result: z.unknown() }).safeParse(data);
  const prediction = predictionResultSchema.safeParse(nested.success ? nested.data.result : data);
  if (prediction.success) {
    const r = prediction.data;
    return (
      <div className="assistant-evidence">
        <div>
          CPU prediction<strong>{r.cpuTimeMs.toPrecision(4)} ms</strong>
        </div>
        <div>
          GPU prediction<strong>{r.gpuTimeMs.toPrecision(4)} ms</strong>
        </div>
        <div>
          PREDICTED · training source
          <p>
            {r.models.CPU.datasetProvenance} / {r.models.GPU.datasetProvenance}
          </p>
        </div>
      </div>
    );
  }
  const analytical = analyticalResultSchema.safeParse(nested.success ? nested.data.result : data);
  if (analytical.success)
    return (
      <div className="assistant-evidence">
        <div>
          CPU analytical estimate
          <strong>
            {analytical.data.cpu
              ? `${(analytical.data.cpu.totalSeconds * 1000).toPrecision(4)} ms`
              : 'Insufficient data'}
          </strong>
          <small>ANALYTICAL · calculated from saved assumptions</small>
        </div>
        <div>
          GPU analytical estimate
          <strong>
            {analytical.data.gpu
              ? `${(analytical.data.gpu.totalSeconds * 1000).toPrecision(4)} ms`
              : 'Insufficient data'}
          </strong>
          <small>{analytical.data.recommendation}</small>
        </div>
      </div>
    );
  const benchmark = z
    .array(
      z.object({
        id: z.string(),
        valid: z.boolean(),
        measurement: z.object({
          config: z.object({ scope: z.string() }),
          cpu: z.object({ summary: z.object({ medianMs: z.number() }) }),
          gpu: z.object({ summary: z.object({ medianMs: z.number() }) }).nullable(),
        }),
      }),
    )
    .safeParse(data);
  if (benchmark.success)
    return (
      <div className="assistant-evidence">
        {benchmark.data.map((r) => (
          <div key={r.id}>
            MEASURED · {r.measurement.config.scope}
            <strong>CPU {r.measurement.cpu.summary.medianMs.toPrecision(4)} ms</strong>
            <p>
              {r.measurement.gpu
                ? `GPU ${r.measurement.gpu.summary.medianMs.toPrecision(4)} ms`
                : 'GPU unavailable'}
            </p>
            <small>
              {r.valid
                ? 'Correctness passed'
                : 'Correctness failed — do not use as performance evidence'}
            </small>
          </div>
        ))}
      </div>
    );
  const explanation = explanationResultSchema.safeParse(data);
  if (explanation.success) {
    const r = explanation.data;
    return (
      <div className="assistant-evidence">
        {r.kind === 'LOCAL' ? (
          (['CPU', 'GPU'] as const).map((target) => (
            <div key={target}>
              {target} · SHAP model attribution
              {r.models[target].contributions.slice(0, 3).map((c) => (
                <p key={c.feature}>
                  {c.feature}: {c.value.toPrecision(4)} ln(ms)
                </p>
              ))}
              <small>Separate baseline · model behavior, not causality</small>
            </div>
          ))
        ) : (
          <div>
            Global SHAP · {r.global.model.target}
            {r.global.importance.slice(0, 3).map((c) => (
              <p key={c.feature}>
                {c.feature}: {c.meanAbsShap.toPrecision(4)} ln(ms)
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }
  return null;
}
