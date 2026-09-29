import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createSession, verifyLogin } from "@/lib/auth.server";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request." }, { status: 400 });
        }

        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid details." },
            { status: 400 },
          );
        }

        try {
          const user = await verifyLogin(parsed.data.email, parsed.data.password);
          if (!user) {
            return Response.json({ error: "Wrong email or password." }, { status: 401 });
          }
          const token = await createSession(user.id);
          return Response.json({ token, user });
        } catch (error) {
          console.error("Login error", error);
          return Response.json(
            { error: "Could not log in right now. Please try again." },
            { status: 500 },
          );
        }
      },
    },
  },
});
