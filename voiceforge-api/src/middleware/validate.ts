import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, type ZodError } from 'zod';

export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        error: 'Validation failed',
        issues: zodError.issues.map(i => i.message)
      });
      return;
    }

    req[source] = result.data;
    next();
  };
}
