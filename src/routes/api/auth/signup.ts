import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createUser, createSession, findUserByEmail } from "@/lib/auth.server";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }

        const parsed = signupSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid details." },
            { status: 400 },
          );
        }

        const { name, email, password } = parsed.data;
        try {
          const existing = await findUserByEmail(email);
          if (existing) {
            return Response.json(
              { error: "An account with this email already exists. Please log in." },
              { status: 409 },
            );
          }
          const user = await createUser(name, email, password);
          const token = await createSession(user.id);
          return Response.json({ token, user }, { status: 201 });
        } catch (error) {
          console.error("Signup error", error);
          return Response.json(
            { error: "Could not create the account. Please try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});
