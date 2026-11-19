import PDFDocument from 'pdfkit';
import { type ReportSnapshot } from '@corewise/types';
import { safeCsv } from '../../lib/csv.js';
import { fields } from './snapshot.js';
// Core PDF fonts are deterministic and require no network/system font access.
// Unsupported Unicode is represented explicitly; UTF-8 originals remain in CSV/snapshot.
export function pdfText(value: unknown) {
  return String(value ?? 'Unknown')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replaceAll('µ', 'u')
    .replaceAll('×', 'x')
    .replace(/[^\x20-\x7E\n]/gu, (c) => `[U+${c.codePointAt(0)!.toString(16).toUpperCase()}]`);
}
export function reportCsv(snapshot: ReportSnapshot, reportId: string) {
  const rows: Record<string, unknown>[] = [];
  for (const [kind, records] of Object.entries(snapshot.sources))
    for (const record of records)
      for (const field of fields(record))
        rows.push({
          report_id: reportId,
          schema_version: snapshot.schemaVersion,
          generated_at: snapshot.generatedAt,
          source_kind: kind,
          source_id: record.id,
          provenance: 'provenance' in record ? record.provenance : 'SHAP_MODEL_ATTRIBUTION',
          field: field.label,
          value: field.value,
          unit:
            field.unit ||
            (/contributions.*value|meanAbsShap|baselineOutput|finalOutput/i.test(field.label)
              ? 'ln(ms)'
              : ''),
        });
  return Buffer.from(
    safeCsv(rows, [
      'report_id',
      'schema_version',
      'generated_at',
      'source_kind',
      'source_id',
      'provenance',
      'field',
      'value',
      'unit',
    ]),
    'utf8',
  );
}
export async function reportPdf(snapshot: ReportSnapshot, reportId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 54, bottom: 55, left: 48, right: 48 },
      bufferPages: true,
      info: {
        Title: pdfText(snapshot.title),
        Author: 'CoreWise AI',
        Subject: 'Immutable hardware and performance evidence',
        CreationDate: new Date(snapshot.generatedAt),
        ModDate: new Date(snapshot.generatedAt),
      },
    });
    const chunks: Buffer[] = [];
    let size = 0,
      pages = 1,
      sectionLabel = '';
    doc.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2500000) {
        doc.destroy(new Error('PDF exceeds export size limit.'));
        return;
      }
      chunks.push(chunk);
    });
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('pageAdded', () => {
      pages++;
      if (pages > 80) throw Error('PDF exceeds 80-page limit. Select fewer sources.');
      if (sectionLabel) {
        doc
          .save()
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#667085')
          .text(pdfText(sectionLabel), 48, 28, {
            width: 500,
            height: 12,
            ellipsis: true,
            lineBreak: false,
          })
          .restore();
        doc.x = 48;
        doc.y = 54;
      }
    });
    const width = doc.page.width - 96,
      bottom = () => doc.page.height - 62;
    function ensure(height: number) {
      if (doc.y + height > bottom()) doc.addPage();
    }
    function text(value: unknown, size = 9, color = '#344054') {
      doc
        .font('Helvetica')
        .fontSize(size)
        .fillColor(color)
        .text(pdfText(value), { width, lineGap: 3 });
    }
    function heading(value: string, size = 17) {
      ensure(45);
      doc
        .font('Helvetica-Bold')
        .fontSize(size)
        .fillColor('#18202b')
        .text(pdfText(value), { width, lineGap: 3 });
      doc.moveDown(0.55);
    }
    function note(value: string) {
      const str = pdfText(value);
      doc.font('Helvetica').fontSize(9);
      const h = doc.heightOfString(str, { width, lineGap: 3 });
      ensure(h + 12);
      text(str);
      doc.moveDown(0.5);
    }
    try {
      doc
        .fillColor('#c92d3a')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('COREWISE AI / EVIDENCE REPORT');
      doc.moveDown(1);
      heading(snapshot.title, 26);
      text(snapshot.type.replaceAll('_', ' '), 10);
      doc.moveDown();
      text(`Generated (UTC): ${snapshot.generatedAt}`);
      text(`Report ID: ${reportId}`);
      text(`Snapshot: ${snapshot.schemaVersion} / export cw-export-1`);
      doc.moveDown();
      note(
        'Independent source records are shown separately. This report does not create measurements, predictions, calibration or causal claims.',
      );
      heading('Evidence index', 13);
      for (const r of snapshot.references) note(`${r.kind} / ${r.id} / ${r.provenance}`);
      heading('Reading this report', 13);
      for (const limit of snapshot.limitations) note(limit);
      note(
        'PDF uses an ASCII-safe rendering; unsupported characters appear as U+ code points. Original UTF-8 values and full tabular snapshots are available in CSV and the saved report.',
      );
      for (const [index, s] of snapshot.sections.entries()) {
        sectionLabel = s.title;
        doc.addPage();
        text(`SECTION ${index + 1} / ${s.kind.toUpperCase()}`, 9, '#c92d3a');
        doc.moveDown(0.5);
        heading(s.title, 19);
        text(`Source: ${s.id}`);
        text(`Provenance: ${s.provenance}`, 9, '#7048c7');
        doc.moveDown();
        if (s.chart && s.chart.bars.length) {
          heading(s.chart.title, 12);
          text(
            `Units: ${s.chart.unit}. ${s.chart.signed ? 'Positive and negative values are signed model contributions.' : 'Values are shown on a common scale within this source only.'}`,
          );
          doc.moveDown();
          const max = Math.max(...s.chart.bars.map((b) => Math.abs(b.value)), 1e-15);
          for (const b of s.chart.bars) {
            ensure(32);
            const y = doc.y,
              label = pdfText(b.label);
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor('#344054')
              .text(label, 48, y, { width: 152, height: 24, ellipsis: true });
            const x = 210,
              barWidth = 230,
              zero = s.chart.signed ? x + barWidth / 2 : x;
            doc
              .save()
              .strokeColor('#dfe4ea')
              .moveTo(zero, y)
              .lineTo(zero, y + 14)
              .stroke();
            const length = (Math.abs(b.value) / max) * (s.chart.signed ? barWidth / 2 : barWidth);
            if (length > 0)
              doc
                .rect(b.value < 0 ? zero - length : zero, y + 2, Math.max(length, 0.5), 10)
                .fill(b.value < 0 ? '#168466' : '#c92d3a');
            doc.restore();
            doc
              .fillColor('#18202b')
              .fontSize(8)
              .text(b.value.toPrecision(5), 447, y, { width: 100 });
            doc.x = 48;
            doc.y = y + 29;
          }
          doc.moveDown(0.5);
        }
        heading('Configuration and source metadata', 12);
        for (const f of s.fields) {
          // The PDF is a readable evidence summary; large arrays remain complete in CSV/snapshot.
          if (/trainingRowIndices\.|rowIndices\./.test(f.label)) continue;
          const label = pdfText(f.label),
            value =
              pdfText(f.value === null ? 'Unknown' : f.value) +
              (f.unit ? ` ${pdfText(f.unit)}` : '');
          doc.font('Helvetica').fontSize(8);
          const height =
            Math.max(
              doc.heightOfString(label, { width: 185, lineGap: 2 }),
              doc.heightOfString(value, { width: width - 205, lineGap: 2 }),
            ) + 8;
          ensure(height);
          const y = doc.y;
          doc.fillColor('#667085').text(label, 48, y, { width: 185, lineGap: 2 });
          doc.fillColor('#18202b').text(value, 253, y, { width: width - 205, lineGap: 2 });
          doc
            .strokeColor('#e4e7ec')
            .moveTo(48, y + height - 5)
            .lineTo(48 + width, y + height - 5)
            .stroke();
          doc.x = 48;
          doc.y = y + height;
        }
        doc.moveDown();
        heading('Assumptions and limitations', 12);
        for (const n of s.notes) note(n);
      }
      const range = doc.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page++) {
        doc.switchToPage(page);
        doc.save();
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#667085')
          .text(
            `CoreWise AI / ${reportId.slice(0, 12)} / ${page + 1} of ${range.count}`,
            48,
            doc.page.height - 36,
            { width, height: 12, lineBreak: false },
          );
        doc.restore();
      }
      doc.end();
    } catch (e) {
      doc.destroy(e instanceof Error ? e : new Error('PDF generation failed.'));
      reject(e);
    }
  });
}
