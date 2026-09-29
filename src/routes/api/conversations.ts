import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "@/lib/mongo.server";
import { getChatOwner } from "@/lib/chat-owner.server";

/** GET /api/conversations — list all chats (with messages) for this user/device, newest first. */
export const Route = createFileRoute("/api/conversations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const owner = await getChatOwner(request);
          if (!owner) return Response.json({ error: "Missing user." }, { status: 401 });
          const db = await getDb();
          const docs = await db
            .collection("conversations")
            .find({ owner })
            .sort({ updatedAt: -1 })
            .limit(200)
            .toArray();
          return Response.json({
            conversations: docs.map((d) => ({
              id: d.convId,
              title: d.title,
              messages: d.messages,
              updatedAt: d.updatedAt,
            })),
          });
        } catch (error) {
          console.error("List conversations error", error);
          return Response.json({ error: "Could not load chats." }, { status: 500 });
        }
      },
    },
  },
});
