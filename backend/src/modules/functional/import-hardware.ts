import { Prisma, type LocalAgent } from '@prisma/client';
import { detectedEnvironmentSchema } from '@corewise/types';
import { ApiError } from '../../lib/errors.js';

// Call only after validating the agent owner or consuming its owner-bound pairing ticket.
export async function importDetectedProfile(
  tx: Prisma.TransactionClient,
  agent: LocalAgent,
  name: string,
  setDefault: boolean,
) {
  const userId = agent.userId;
  const e = detectedEnvironmentSchema.parse(agent.environment),
    gpu = e.gpus[0];
  if (!e.cpuModel)
    throw new ApiError(
      422,
      'DETECTION_INCOMPLETE',
      'CPU identity is unavailable. Create a reviewed manual profile.',
    );
  const p = await tx.hardwareProfile.create({
    data: {
      userId,
      name: name,
      manufacturer: '',
      deviceModel: e.hostname ?? '',
      os: e.os,
      description:
        'Imported from an owned local runner. Detected properties are runner-reported observations, not independently verified specifications. Unknown clock/bandwidth/type fields remain empty.',
      cpuManufacturer: e.cpuManufacturer ?? 'Unknown',
      cpuName: e.cpuModel!,
      physicalCores: e.physicalCores,
      logicalProcessors: e.logicalCpus,
      cpuBaseGhz: null,
      cpuMaxGhz: null,
      gpuManufacturer: gpu
        ? gpu.source === 'nvidia-smi'
          ? 'NVIDIA'
          : gpu.model.toLowerCase().includes('amd')
            ? 'AMD'
            : gpu.model.toLowerCase().includes('intel')
              ? 'Intel'
              : 'Unknown'
        : '',
      gpuName: gpu?.model ?? e.gpuRuntime?.model ?? null,
      vramGb: gpu ? gpu.memoryBytes / 1e9 : e.gpuRuntime ? e.gpuRuntime.memoryBytes / 1e9 : null,
      memoryBandwidthGbps: null,
      computeCapability: null,
      ramGb: e.totalRamBytes / 2 ** 30,
      memoryType: '',
      memoryFrequencyMhz: null,
      provenance: 'MEASURED',
      detectionSnapshot: JSON.parse(
        JSON.stringify({
          agentId: agent.id,
          source: 'LOCAL_RUNNER',
          importedAt: new Date().toISOString(),
          ramUnit: 'GiB (bytes / 2^30)',
          environment: e,
        }),
      ) as Prisma.InputJsonValue,
    },
  });
  await tx.user.update({
    where: { id: userId },
    data: { selectedProfileId: p.id, ...(setDefault ? { defaultProfileId: p.id } : {}) },
  });
  return p;
}
