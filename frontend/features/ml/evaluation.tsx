'use client';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MLModel } from '@corewise/types';

export function Evaluation({ model, models }: { model: MLModel; models: MLModel[] }) {
  const evaluation = model.evaluation;
  const rows = models
    .filter((m) => m.trainingJobId === model.trainingJobId && m.target === model.target)
    .map((m) => ({ algorithm: m.algorithm, rmse: m.evaluation.validation.rmseMs }));
  return (
    <section className="panel ml-evaluation">
      <div className="section-heading">
        <div>
          <span className="eyebrow">HELD-OUT EVALUATION · {model.target}</span>
          <h2>{model.name}</h2>
        </div>
        <span className="badge">{model.provenance}</span>
      </div>
      <p className="notice">{evaluation.label}</p>
      <div className="ml-metrics">
        {[
          ['MAE', evaluation.test.maeMs, 'ms'],
          ['RMSE', evaluation.test.rmseMs, 'ms'],
          ['R²', evaluation.test.r2, ''],
        ].map(([label, value, unit]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {Number(value).toPrecision(4)} <small>{unit}</small>
            </strong>
          </div>
        ))}
      </div>
      <p className="muted">
        Selection: {evaluation.selectionMetric}. Split: {evaluation.split.strategy} ·{' '}
        {evaluation.split.trainRows} training / {evaluation.split.validationRows} validation /{' '}
        {evaluation.split.testRows} test records. Preprocessing fits training data only. No groups
        overlap.
      </p>
      <div className="ml-chart-grid">
        <div className="ml-chart" role="img" aria-label="Algorithm validation RMSE comparison">
          <h3>Validation RMSE · ms ↓</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="algorithm" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis width={50} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="rmse" fill="var(--accent)" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div
          className="ml-chart"
          role="img"
          aria-label="Actual versus predicted held-out execution times"
        >
          <h3>Actual vs predicted · ms</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="actualMs" type="number" name="Actual ms" tick={{ fontSize: 10 }} />
              <YAxis
                dataKey="predictedMs"
                type="number"
                name="Predicted ms"
                width={50}
                tick={{ fontSize: 10 }}
              />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter
                data={evaluation.points.slice(0, 500)}
                fill="var(--accent)"
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <div className="ml-chart" role="img" aria-label="Held-out residual visualization">
          <h3>Residuals · actual − predicted ms</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ScatterChart>
              <CartesianGrid stroke="var(--border)" />
              <XAxis
                dataKey="predictedMs"
                type="number"
                name="Predicted ms"
                tick={{ fontSize: 10 }}
              />
              <YAxis
                dataKey="residualMs"
                type="number"
                name="Residual ms"
                width={50}
                tick={{ fontSize: 10 }}
              />
              <Tooltip />
              <Scatter
                data={evaluation.points.slice(0, 500)}
                fill="var(--accent)"
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
      <small>
        Plots show up to 500 held-out points. Metrics use the entire held-out set. Version{' '}
        {model.version}.
      </small>
      <details>
        <summary>Per-family errors and training metadata</summary>
        <div className="ml-table-wrap">
          <table className="ml-table">
            <thead>
              <tr>
                <th>Family</th>
                <th>Records</th>
                <th>MAE ms</th>
                <th>RMSE ms</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(evaluation.perFamily).map(([family, m]) => (
                <tr key={family}>
                  <td>{family}</td>
                  <td>{m.count}</td>
                  <td>{m.maeMs.toPrecision(4)}</td>
                  <td>{m.rmseMs.toPrecision(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <pre className="ml-code">
          {JSON.stringify(
            {
              config: model.trainingConfig,
              dependencies: evaluation.versions,
              split: evaluation.split,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}
