import { z } from 'zod';

export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Garden',
  'Sports',
  'Books',
  'Toys',
  'Beauty',
  'Food',
] as const;

export const listProductsQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
});

export const productBody = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  stock: z.number().int().min(0, 'Stock must be non-negative'),
  category: z.enum(PRODUCT_CATEGORIES, {
    error: () => ({ message: `Category must be one of: ${PRODUCT_CATEGORIES.join(', ')}` }),
  }),
  images: z.array(z.string().min(1)).min(1, 'At least one image is required'),
});

export const createReviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1, 'Comment is required'),
});

export type ListProductsQuery = z.infer<typeof listProductsQuery>;
export type ProductBody = z.infer<typeof productBody>;
export type CreateReviewBody = z.infer<typeof createReviewBody>;
