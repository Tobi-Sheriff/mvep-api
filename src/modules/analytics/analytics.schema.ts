import { z } from 'zod';

export const revenuePeriodQuery = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']),
});

export type RevenuePeriodQuery = z.infer<typeof revenuePeriodQuery>;
