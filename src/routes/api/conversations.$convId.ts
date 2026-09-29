import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getDb } from "@/lib/mongo.server";
import { getChatOwner } from "@/lib/chat-owner.server";

const conversationSchema = z.object({
  title: z.string().min(1).max(120),
  updatedAt: z.number(),
  messages: z
    .array(
      z.object({
        id: z.string().max(64),
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20000),
        sources: z
          .array(
            z.object({ act: z.string(), section: z.string(), title: z.string(), source: z.string() }),
          )
          .optional(),
      }),
    )
    .max(500),
});

/** PUT saves (creates or replaces) a chat with all its messages; DELETE removes it. */
export const Route = createFileRoute("/api/conversations/$convId")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        try {
          const owner = await getChatOwner(request);
          if (!owner) return Response.json({ error: "Missing user." }, { status: 401 });
          const parsed = conversationSchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return Response.json({ error: "Invalid chat data." }, { status: 400 });
          const db = await getDb();
          await db.collection("conversations").updateOne(
            { owner, convId: params.convId },
            { $set: parsed.data, $setOnInsert: { owner, convId: params.convId, createdAt: new Date() } },
            { upsert: true },
          );
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Save conversation error", error);
          return Response.json({ error: "Could not save chat." }, { status: 500 });
        }
      },
      DELETE: async ({ request, params }) => {
        try {
          const owner = await getChatOwner(request);
          if (!owner) return Response.json({ error: "Missing user." }, { status: 401 });
          const db = await getDb();
          await db.collection("conversations").deleteOne({ owner, convId: params.convId });
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Delete conversation error", error);
          return Response.json({ error: "Could not delete chat." }, { status: 500 });
        }
      },
    },
  },
});
