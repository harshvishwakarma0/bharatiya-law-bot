import { createFileRoute } from "@tanstack/react-router";
import { deleteSession } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
        if (token) {
          try {
            await deleteSession(token);
          } catch (error) {
            console.error("Logout error", error);
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
