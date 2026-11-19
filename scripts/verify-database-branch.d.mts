export function verifyDatabaseBranch(
  env: Record<string, string | undefined>,
  environment: string,
): {
  connected: boolean;
  branchVerified: boolean;
  endpointHost: string;
  endpointPort: number;
  databaseName: string;
  databaseRole: string;
  publicTables: string[];
};
