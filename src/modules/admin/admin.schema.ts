import { z } from 'zod';

export const listUsersQuery = z.object({
  role: z.enum(['customer', 'vendor', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const updateUserStatusBody = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
  reason: z.string().optional(),
});

export const listVendorsQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const listAdminOrdersQuery = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  vendorId: z.string().optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const platformPeriodQuery = z.object({
  period: z.enum(['7d', '30d', '90d', '1y']),
});

export type ListUsersQuery = z.infer<typeof listUsersQuery>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBody>;
export type ListVendorsQuery = z.infer<typeof listVendorsQuery>;
export type ListAdminOrdersQuery = z.infer<typeof listAdminOrdersQuery>;
export type PlatformPeriodQuery = z.infer<typeof platformPeriodQuery>;
