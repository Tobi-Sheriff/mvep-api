import { z } from 'zod';

export const updateProfileBody = z.object({
  name: z.string().min(1, 'Name cannot be empty'),
  avatar: z.string().nullable().optional(),
});

export type UpdateProfileBody = z.infer<typeof updateProfileBody>;
