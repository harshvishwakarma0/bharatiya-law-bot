import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "@/lib/mongo.server";
import { getUserFromRequest } from "@/lib/auth.server";
import { caseSchema } from "@/lib/case-schema";

/** GET /api/cases — list the logged-in user's cases (newest first). */
/** POST /api/cases — create a new case record for the logged-in user. */

export const Route = createFileRoute("/api/cases")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await getUserFromRequest(request);
          if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });

          const db = await getDb();
          const docs = await db
            .collection("cases")
            .find({ userId: user.id })
            .sort({ createdAt: -1 })
            .toArray();

          return Response.json({
            cases: docs.map((d) => ({
              ...d,
              _id: d._id.toString(),
              createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
              updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt),
            })),
          });
        } catch (error) {
          console.error("List cases error", error);
          return Response.json({ error: "Could not load cases." }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        try {
          const user = await getUserFromRequest(request);
          if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });

          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return Response.json({ error: "Invalid request." }, { status: 400 });
          }

          const parsed = caseSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              {
                error: "Please fix the highlighted fields.",
                fieldErrors: Object.fromEntries(
                  parsed.error.issues.map((i) => [i.path.join("."), i.message]),
                ),
              },
              { status: 400 },
            );
          }

          const db = await getDb();
          const now = new Date();
          const result = await db.collection("cases").insertOne({
            ...parsed.data,
            userId: user.id,
            createdAt: now,
            updatedAt: now,
          });

          return Response.json(
            {
              case: {
                ...parsed.data,
                _id: result.insertedId.toString(),
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              },
            },
            { status: 201 },
          );
        } catch (error) {
          console.error("Create case error", error);
          return Response.json({ error: "Could not save the case." }, { status: 500 });
        }
      },
    },
  },
});
