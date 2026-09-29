import { MongoClient, type Db } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

/**
 * Returns a shared Mongo database handle.
 * The connection string comes from the MONGODB_URI secret (server-only).
 */
export function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return Promise.reject(new Error("MONGODB_URI is not configured"));
  }
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    clientPromise = client.connect().then(async (connected) => {
      const db = connected.db("nyaya_sahayak");
      // Idempotent indexes: unique emails, fast token lookups, per-user case lists.
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("sessions").createIndex({ token: 1 }, { unique: true }),
        db.collection("sessions").createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
        db.collection("cases").createIndex({ userId: 1, createdAt: -1 }),
      ]);
      return connected;
    });
  }
  return clientPromise.then((client) => client.db("nyaya_sahayak"));
}
