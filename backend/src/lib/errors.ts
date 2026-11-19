import type { RequestHandler } from 'express';
import type { z } from '@corewise/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export function validate(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'form';
        (fields[key] ??= []).push(issue.message);
      }
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Check the highlighted fields.', fields));
    }
    req.body = result.data;
    next();
  };
}
