#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ca1ff854fa46812aa77d64c6b706dd156740a537d9f7e3e4fb5ca6867738622f/contract';
import endContract from '../../snapshots/ca1ff854fa46812aa77d64c6b706dd156740a537d9f7e3e4fb5ca6867738622f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Benchmark',
        columns: [
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('device', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('durationMs', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('efficiency', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('gflops', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('matrixSize', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('threads', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('workload', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Benchmark_device_check_c0989f8f', sql`"device" IN ('cpu', 'gpu')`),
          checkExpression(
            'Benchmark_kind_check_3c59211d',
            sql`"kind" IN ('matmul', 'conv2d', 'attention', 'reduction', 'sort')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Prediction',
        columns: [
          col('confidence', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('createdAt', 'timestamptz(3)', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-date@1', typeParams: { precision: 3 } },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('matrixSize', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('predictedDurationMs', 'float8', {
            notNull: true,
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('reasoning', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recommendedDevice', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('threads', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('workload', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Prediction_kind_check_3c59211d',
            sql`"kind" IN ('matmul', 'conv2d', 'attention', 'reduction', 'sort')`,
          ),
          checkExpression(
            'Prediction_recommendedDevice_check_5d8dce6d',
            sql`"recommendedDevice" IN ('cpu', 'gpu')`,
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Benchmark',
        index: 'Benchmark_kind_device_idx_97b947b8',
        columns: ['kind', 'device'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Prediction',
        index: 'Prediction_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
