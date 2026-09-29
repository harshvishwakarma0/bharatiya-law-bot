import { createFileRoute } from "@tanstack/react-router";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongo.server";
import { getUserFromRequest } from "@/lib/auth.server";
import { caseSchema } from "@/lib/case-schema";

/** GET /api/cases/:id — read one case (own only). */
/** PUT /api/cases/:id — update a case (own only). */
/** DELETE /api/cases/:id — delete a case (own only). */

async function resolveCase(request: Request, caseId: string) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { error: Response.json({ error: "Please log in first." }, { status: 401 }) };
  }
  if (!ObjectId.isValid(caseId)) {
    return { error: Response.json({ error: "Invalid case id." }, { status: 400 }) };
  }
  const db = await getDb();
  const doc = await db.collection("cases").findOne({
    _id: new ObjectId(caseId),
    userId: user.id,
  });
  if (!doc) {
    return { error: Response.json({ error: "Case not found." }, { status: 404 }) };
  }
  return { db, user };
}

function serialize(doc: Record<string, unknown>) {
  return {
    ...doc,
    _id: (doc._id as { toString(): string }).toString(),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
  };
}

export const Route = createFileRoute("/api/cases/$caseId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const ctx = await resolveCase(request, params.caseId);
          if (ctx.error) return ctx.error;
          const doc = await ctx.db.collection("cases").findOne({
            _id: new ObjectId(params.caseId),
            userId: ctx.user.id,
          });
          if (!doc) return Response.json({ error: "Case not found." }, { status: 404 });
          return Response.json({ case: serialize(doc as Record<string, unknown>) });
        } catch (error) {
          console.error("Get case error", error);
          return Response.json({ error: "Could not load the case." }, { status: 500 });
        }
      },

      PUT: async ({ request, params }) => {
        try {
          const ctx = await resolveCase(request, params.caseId);
          if (ctx.error) return ctx.error;

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

          const result = await ctx.db.collection("cases").findOneAndUpdate(
            { _id: new ObjectId(params.caseId), userId: ctx.user.id },
            { $set: { ...parsed.data, updatedAt: new Date() } },
            { returnDocument: "after" },
          );
          if (!result) return Response.json({ error: "Case not found." }, { status: 404 });
          return Response.json({ case: serialize(result as unknown as Record<string, unknown>) });
        } catch (error) {
          console.error("Update case error", error);
          return Response.json({ error: "Could not update the case." }, { status: 500 });
        }
      },

      DELETE: async ({ request, params }) => {
        try {
          const ctx = await resolveCase(request, params.caseId);
          if (ctx.error) return ctx.error;

          const result = await ctx.db.collection("cases").deleteOne({
            _id: new ObjectId(params.caseId),
            userId: ctx.user.id,
          });
          if (result.deletedCount === 0) {
            return Response.json({ error: "Case not found." }, { status: 404 });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Delete case error", error);
          return Response.json({ error: "Could not delete the case." }, { status: 500 });
        }
      },
    },
  },
});
