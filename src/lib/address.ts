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
  /** Neighbourhood or community, e.g. Jumeirah Lakes Towers. */
  area: z.string().trim().max(120).optional().default(""),
  poBox: z.string().trim().max(20).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export type Address = z.infer<typeof addressSchema>;

/** Parse a checkout or account address form. Field names may carry a prefix. */
export function addressFromFormData(formData: FormData, prefix = "") {
  const field = (name: string) =>
    prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name;

  return addressSchema.safeParse({
    fullName: String(formData.get(field("fullName")) ?? ""),
    phone: String(formData.get(field("phone")) ?? ""),
    emirate: String(formData.get(field("emirate")) ?? ""),
    street: String(formData.get(field("street")) ?? ""),
    building: String(formData.get(field("building")) ?? ""),
    area: String(formData.get(field("area")) ?? ""),
    poBox: String(formData.get(field("poBox")) ?? ""),
    notes: String(formData.get(field("notes")) ?? ""),
  });
}

/** The parts of an address needed for display; saved rows and orders both fit. */
export type AddressLines = {
  fullName: string;
  phone: string;
  emirate: string;
  street: string;
  building: string;
  area?: string;
  poBox?: string;
};

export function formatAddress(address: AddressLines): string[] {
  return [
    address.fullName,
    `${address.building}, ${address.street}`,
    address.area ?? "",
    address.emirate,
    address.poBox ? `PO Box ${address.poBox}` : "",
    address.phone,
  ].filter(Boolean);
}
