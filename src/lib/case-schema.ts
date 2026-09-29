import { z } from "zod";

export const CASE_CATEGORIES = [
  "Consumer",
  "Tenant",
  "Employment",
  "Criminal",
  "Family",
  "Other",
] as const;

export const CASE_STATUSES = ["Open", "In Progress", "Resolved"] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** Shared validation: used by the client form AND the server API routes. */
export const caseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  category: z.enum(CASE_CATEGORIES, { message: "Select a category" }),
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(120, "Title is too long"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description is too long (max 1000 characters)"),
  status: z.enum(CASE_STATUSES, { message: "Select a status" }),
});

export type CaseInput = z.infer<typeof caseSchema>;

export type CaseRecord = CaseInput & {
  _id: string;
  createdAt: string;
  updatedAt: string;
};
