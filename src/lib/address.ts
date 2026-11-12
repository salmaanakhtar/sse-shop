import { z } from "zod";

export const EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
] as const;

/**
 * UAE delivery address. There are no postal codes here: emirate, street, and
 * building identify a place, and a PO box is optional.
 */
export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+971\d{9}$/, "Enter a UAE number as +971 followed by 9 digits"),
  emirate: z.enum(EMIRATES),
  street: z.string().trim().min(3, "Enter the street").max(160),
  building: z.string().trim().min(1, "Enter the building or villa").max(120),
  poBox: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export type Address = z.infer<typeof addressSchema>;

export function formatAddress(address: Address): string[] {
  return [
    address.fullName,
    `${address.building}, ${address.street}`,
    address.emirate,
    address.poBox ? `PO Box ${address.poBox}` : "",
    address.phone,
  ].filter(Boolean);
}
