import type { MLModel, SharedModelPublication, HardwareProfile } from '@prisma/client';
import { sharedCompatibilitySchema, sharedModelSchema } from '@corewise/types';
import { ApiError } from '../../lib/errors.js';

export function publicationActive(model: MLModel, p: SharedModelPublication | null) {
  return (
    !!p && !p.revokedAt && p.approvedArtifactSha256 === model.sha256 && model.status === 'READY'
  );
}
export function sharedView(model: MLModel, p: SharedModelPublication) {
  return sharedModelSchema.parse({
    id: model.id,
    algorithm: model.algorithm,
    target: model.target,
    version: model.version,
    access: 'SHARED_EXPERIMENTAL',
    compatibility: p.hardwareCompatibility,
    limitations: p.limitations,
    evaluation: model.evaluation,
  });
}
export function assertSharedCompatibility(
  p: SharedModelPublication,
  hardware: HardwareProfile,
  features: Record<string, unknown>,
) {
  const policy = sharedCompatibilitySchema.parse(p.hardwareCompatibility);
  const fail = (message: string): never => {
    throw new ApiError(422, 'SHARED_INCOMPATIBLE', message);
  };
  if (hardware.cpuName !== policy.cpuModel || hardware.gpuName !== policy.gpuModel)
    fail(
      'Shared model requires the exact approved CPU and GPU identities. Choose a compatible profile or use an analytical estimate.',
    );
  if (
    !policy.workloads.includes(String(features.workload_type)) ||
    !policy.precisions.includes(String(features.precision))
  )
    fail('Workload or precision is outside this shared model’s approved support.');
  for (const [key, [low, high]] of Object.entries(policy.ranges)) {
    const value = features[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
      fail(`Shared inference requires ${key} within [${low}, ${high}]. Extrapolation is disabled.`);
  }
}
