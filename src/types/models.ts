import { z } from 'zod'

export const ClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  updatedAt: z.number(),
})

export type Client = z.infer<typeof ClientSchema>
