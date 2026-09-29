import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "./mongo.server";

export type SessionUser = { id: string; name: string; email: string };

export async function createUser(name: string, email: string, password: string) {
  const db = await getDb();
  const passwordHash = await hash(password, 10);
  const result = await db
    .collection("users")
    .insertOne({ name, email: email.toLowerCase(), passwordHash, createdAt: new Date() });
  return { id: result.insertedId.toString(), name, email: email.toLowerCase() };
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  return db.collection("users").findOne({ email: email.toLowerCase() });
}

export async function verifyLogin(email: string, password: string): Promise<SessionUser | null> {
  const db = await getDb();
  const user = await db.collection("users").findOne({ email: email.toLowerCase() });
  if (!user?.passwordHash) return null;
  const ok = await compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user._id.toString(), name: user.name as string, email: user.email as string };
}

export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  await db.collection("sessions").insertOne({
    token,
    userId: new ObjectId(userId),
    createdAt: new Date(),
  });
  return token;
}

export async function deleteSession(token: string) {
  const db = await getDb();
  await db.collection("sessions").deleteOne({ token });
}

/** Reads the Authorization: Bearer <token> header and resolves the logged-in user. */
export async function getUserFromRequest(request: Request): Promise<SessionUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const db = await getDb();
  const session = await db.collection("sessions").findOne({ token });
  if (!session) return null;

  const user = await db.collection("users").findOne(
    { _id: session.userId },
    { projection: { passwordHash: 0 } },
  );
  if (!user) return null;
  return { id: user._id.toString(), name: user.name as string, email: user.email as string };
}
