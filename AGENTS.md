<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

<!-- AGENTS:BEGIN decisions -->
## Technical decisions

- MongoDB access is server-only: `src/lib/mongo.server.ts` holds a cached `MongoClient` built from the `MONGODB_URI` secret (read inside handlers, never imported client-side). Why: keeps credentials out of the browser bundle.
- Auth + Case CRUD use raw server routes under `src/routes/api/` (not createServerFn) so Postman/curl can call them directly for the college practical. Why: the practical requires screenshotting raw HTTP requests.
- Auth = email/password (bcryptjs hash in `users` collection) + random 32-byte bearer token stored in a `sessions` collection (30-day TTL index). Client stores the token in localStorage and sends `Authorization: Bearer`.
- Validation is shared: `src/lib/case-schema.ts` (zod) is used by BOTH the dashboard form (react-hook-form + zodResolver) and the API routes. Why: one source of truth for field rules.
- Chat history lives in MongoDB `conversations` (owner = `user:<id>` when logged in, else `device:<X-Device-Id>`); client syncs changed chats via PUT /api/conversations/$convId, localStorage is only an offline backup. Why: history persists and follows the account across devices.
<!-- AGENTS:END decisions -->
