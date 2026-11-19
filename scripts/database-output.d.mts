export function sanitizeDatabaseOutput(
  value: unknown,
  env: Record<string, string | undefined>,
): string;
export function databaseCommandResult(
  result: {
    stdout?: unknown;
    stderr?: unknown;
    status: number | null;
    signal?: string | null;
    error?: { code?: string };
  },
  env: Record<string, string | undefined>,
): {
  success: boolean;
  exitCode: number;
  signal: string | null;
  launchError: string | null;
  prismaErrorCode: string | null;
  migrationName: string | null;
  stdout: string;
  stderr: string;
};
