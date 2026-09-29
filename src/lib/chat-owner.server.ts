import { getUserFromRequest } from "@/lib/auth.server";

/**
 * Who owns a chat: the logged-in account (works on every device) or,
 * when signed out, the anonymous browser id sent in the X-Device-Id header.
 */
export async function getChatOwner(request: Request): Promise<string | null> {
  const user = await getUserFromRequest(request);
  if (user) return `user:${user.id}`;
  const device = request.headers.get("x-device-id") ?? "";
  if (/^[a-zA-Z0-9-]{16,64}$/.test(device)) return `device:${device}`;
  return null;
}
