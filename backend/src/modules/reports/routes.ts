import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { Prisma, type GeneratedReport } from '@prisma/client';
import {
  z,
  reportInputSchema,
  reportSchema,
  reportSummarySchema,
  reportSourcesSchema,
} from '@corewise/types';
import { db } from '../../lib/db.js';
import { ApiError, validate } from '../../lib/errors.js';
import { requireUser } from '../auth/routes.js';
import { buildSnapshot } from './snapshot.js';
import { reportPdf, reportCsv } from './export.js';
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function summary(r: object & { createdAt: Date }) {
  return reportSummarySchema.parse({ ...r, createdAt: r.createdAt.toISOString() });
}
function detail(r: GeneratedReport) {
  return reportSchema.parse({
    ...summary(r),
    configuration: r.configuration,
    snapshot: r.snapshot,
  });
}
export function reportRoutes() {
  const router = Router();
  router.use(requireUser);
  router.use(
    rateLimit({
      windowMs: 60000,
      limit: 40,
      keyGenerator: (req) => req.session.userId!,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: {
          code: 'REPORT_RATE_LIMITED',
          message: 'Too many report requests. Try again shortly.',
        },
      },
    }),
  );
  router.get('/sources', async (req, res) => {
    const userId = req.session.userId!;
    const [hardware, workloads, comparisons, predictions, benchmarks, explanations] =
      await Promise.all([
        db.hardwareProfile.findMany({
          where: { userId },
          select: { id: true, name: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.workload.findMany({
          where: { userId },
          select: { id: true, name: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.comparisonResult.findMany({
          where: { userId, kind: 'COMPARISON' },
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.mLPrediction.findMany({
          where: { userId },
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.benchmarkRun.findMany({
          where: { userId },
          select: { id: true, createdAt: true, valid: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        db.modelExplanation.findMany({
          where: { userId, status: 'COMPLETED' },
          select: { id: true, kind: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      ]);
    res.json(
      reportSourcesSchema.parse({
        data: {
          hardware: hardware.map((r) => ({ id: r.id, label: r.name })),
          workloads: workloads.map((r) => ({ id: r.id, label: r.name })),
          comparisons: comparisons.map((r) => ({
            id: r.id,
            label: `ANALYTICAL · ${r.createdAt.toISOString()} · ${r.id.slice(0, 8)}`,
          })),
          predictions: predictions.map((r) => ({
            id: r.id,
            label: `PREDICTED · ${r.createdAt.toISOString()} · ${r.id.slice(0, 8)}`,
          })),
          benchmarks: benchmarks.map((r) => ({
            id: r.id,
            label: `MEASURED · ${r.valid ? 'valid' : 'correctness failed'} · ${r.createdAt.toISOString()}`,
          })),
          explanations: explanations.map((r) => ({
            id: r.id,
            label: `SHAP ${r.kind} · ${r.createdAt.toISOString()} · ${r.id.slice(0, 8)}`,
          })),
        },
      }),
    );
  });
  router.post('/preview', validate(reportInputSchema), async (req, res) =>
    res.json({ data: await buildSnapshot(req.session.userId!, reportInputSchema.parse(req.body)) }),
  );
  router.post('/', validate(reportInputSchema), async (req, res) => {
    const userId = req.session.userId!,
      input = reportInputSchema.parse(req.body),
      id = randomUUID(),
      snapshot = await buildSnapshot(userId, input);
    let pdf: Buffer, csv: Buffer;
    try {
      pdf = await reportPdf(snapshot, id);
      csv = reportCsv(snapshot, id);
    } catch {
      throw new ApiError(
        422,
        'REPORT_EXPORT_FAILED',
        'The report could not be exported within its limits. Select fewer source records.',
      );
    }
    if (csv.byteLength > 2500000)
      throw new ApiError(
        422,
        'REPORT_TOO_LARGE',
        'CSV exceeds the report limit. Select fewer sources.',
      );
    const report = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
      if ((await tx.generatedReport.count({ where: { userId } })) >= 100)
        throw new ApiError(429, 'REPORT_LIMIT', 'Delete an older report first (limit 100).');
      if (
        (await tx.generatedReport.count({
          where: { userId, createdAt: { gt: new Date(Date.now() - 60000) } },
        })) >= 5
      )
        throw new ApiError(429, 'REPORT_RATE_LIMITED', 'Generate at most five reports per minute.');
      return tx.generatedReport.create({
        data: {
          id,
          userId,
          title: snapshot.title,
          type: input.type,
          configuration: json(input),
          sourceReferences: json(snapshot.references),
          snapshot: json(snapshot),
          sourceCount: snapshot.references.length,
          pdf: Uint8Array.from(pdf),
          csv: Uint8Array.from(csv),
          exportMetadata: json({
            version: 'cw-export-1',
            pdfSha256: sha(pdf),
            csvSha256: sha(csv),
            pdfBytes: pdf.byteLength,
            csvBytes: csv.byteLength,
          }),
        },
      });
    });
    res.status(201).json({ data: detail(report) });
  });
  router.get('/', async (req, res) => {
    const records = await db.generatedReport.findMany({
      where: { userId: req.session.userId! },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
        sourceCount: true,
        exportMetadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ data: records.map(summary) });
  });
  router.use('/:id', async (req, res, next) => {
    const row = await db.generatedReport.findUnique({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Report not found.');
    res.locals.report = row;
    next();
  });
  router.get('/:id', (_req, res) => res.json({ data: detail(res.locals.report) }));
  router.get('/:id/download', (req, res) => {
    const format = z.enum(['pdf', 'csv']).safeParse(req.query.format ?? 'pdf');
    if (!format.success) throw new ApiError(400, 'INVALID_FORMAT', 'Choose PDF or CSV.');
    const report: GeneratedReport = res.locals.report,
      bytes = Buffer.from(format.data === 'pdf' ? report.pdf : report.csv),
      metadata = report.exportMetadata as Record<string, unknown>;
    if (sha(bytes) !== metadata[format.data === 'pdf' ? 'pdfSha256' : 'csvSha256'])
      throw new ApiError(409, 'EXPORT_INTEGRITY', 'Stored export integrity check failed.');
    res
      .set({
        'Content-Type': format.data === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="corewise-${report.id}.${format.data}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  });
  router.delete('/:id', async (req, res) => {
    await db.generatedReport.delete({
      where: { id_userId: { id: String(req.params.id), userId: req.session.userId! } },
    });
    res.status(204).end();
  });
  return router;
}
