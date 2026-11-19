export function databaseSettings(
  env: Record<string, string | undefined>,
  writing?: boolean,
): { environment: string; url: string; directUrl: string };

export function loadDatabaseEnvironment(
  environment?: string,
  inherited?: Record<string, string | undefined>,
): Record<string, string | undefined>;
