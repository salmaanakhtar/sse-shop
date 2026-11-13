import { z } from "zod";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+971\d{9}$/, "Enter a UAE number as +971 followed by 9 digits")
    .or(z.literal(""))
    .optional()
    .default(""),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password"),
  confirmation: z.string().trim(),
});
