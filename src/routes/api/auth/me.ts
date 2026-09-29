import { createFileRoute } from "@tanstack/react-router";
import { getUserFromRequest } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getUserFromRequest(request);
          if (!user) return Response.json({ error: "Not logged in." }, { status: 401 });
          return Response.json({ user });
        } catch (error) {
          console.error("Me error", error);
          return Response.json({ error: "Something went wrong." }, { status: 500 });
        }
      },
    },
  },
});
