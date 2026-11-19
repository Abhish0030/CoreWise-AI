import { z } from 'zod';

const shortText = z.string().trim().max(120);
const requiredText = shortText.min(1, 'This field is required');
export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email').max(254);
export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter at least 2 characters').max(80),
    email: emailSchema,
    password: z
      .string()
      .min(12, 'Use at least 12 characters')
      .max(128, 'Use at most 128 characters'),
  })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1, 'Enter your password').max(128) })
  .strict();
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
  defaultProfileId: z.string().nullable(),
  selectedProfileId: z.string().nullable(),
});
export type CurrentUser = z.infer<typeof userSchema>;
export const userResponseSchema = z.object({ data: userSchema });
export const csrfResponseSchema = z.object({ data: z.object({ token: z.string().min(32) }) });
export const profileUpdateSchema = z.object({ name: z.string().trim().min(2).max(80) }).strict();

const optionalPositive = (max: number) => z.number().finite().positive().max(max).nullable();
const optionalCount = (max: number) => z.number().int().positive().max(max).nullable();
export const hardwareInputSchema = z
  .object({
    name: requiredText,
    manufacturer: shortText,
    deviceModel: shortText,
    os: requiredText,
    description: z.string().trim().max(2000),
    cpuManufacturer: requiredText,
    cpuName: requiredText,
    physicalCores: optionalCount(4096),
    logicalProcessors: optionalCount(8192),
    cpuBaseGhz: optionalPositive(20),
    cpuMaxGhz: optionalPositive(20),
    gpuManufacturer: shortText,
    gpuName: shortText.nullable(),
    vramGb: optionalPositive(4096),
    memoryBandwidthGbps: optionalPositive(100000),
    computeCapability: z.string().trim().max(80).nullable(),
    ramGb: z.number().finite().positive().max(1048576),
    memoryType: z.string().trim().max(40),
    memoryFrequencyMhz: optionalCount(100000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.physicalCores &&
      value.logicalProcessors &&
      value.logicalProcessors < value.physicalCores
    )
      ctx.addIssue({
        code: 'custom',
        path: ['logicalProcessors'],
        message: 'Logical processors must be at least the physical core count',
      });
    if (value.cpuBaseGhz && value.cpuMaxGhz && value.cpuMaxGhz < value.cpuBaseGhz)
      ctx.addIssue({
        code: 'custom',
        path: ['cpuMaxGhz'],
        message: 'Maximum frequency must be at least the base frequency',
      });
    if (
      !value.gpuName &&
      (value.gpuManufacturer ||
        value.vramGb ||
        value.memoryBandwidthGbps ||
        value.computeCapability)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['gpuName'],
        message: 'Enter a GPU model for these GPU specifications',
      });
  });
export type HardwareInput = z.infer<typeof hardwareInputSchema>;
export const hardwareSchema = hardwareInputSchema.safeExtend({
  cpuManufacturer: shortText,
  id: z.string(),
  provenance: z.enum(['USER_ENTERED', 'MEASURED']),
  detectionSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HardwareProfile = z.infer<typeof hardwareSchema>;
export const hardwareResponseSchema = z.object({ data: hardwareSchema });
export const hardwareListSchema = z.object({ data: z.array(hardwareSchema) });
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
