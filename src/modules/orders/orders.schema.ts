import { z } from 'zod';

export const createOrderBody = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'productId is required'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
      }),
    )
    .min(1, 'At least one item is required'),
  shippingAddress: z
    .object({
      line1: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      postcode: z.string().min(1),
      country: z.string().min(1),
    })
    .optional(),
  paymentMethod: z.string().optional(),
});

export const updateOrderStatusBody = z.object({
  status: z.enum(['processing', 'shipped', 'delivered', 'cancelled']),
});

export const listOrdersQuery = z.object({
  status: z
    .enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateOrderBody = z.infer<typeof createOrderBody>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBody>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;
