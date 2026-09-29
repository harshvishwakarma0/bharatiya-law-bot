# Roadmap

## MERN-style practical additions (MongoDB + CRUD + Auth)
- [x] Save MONGODB_URI secret (user added via secure form)
- [x] Install mongodb + bcryptjs
- [x] Server-only Mongo client (src/lib/mongo.server.ts) + indexes
- [x] Auth API: signup / login / logout / me (bearer token sessions)
- [x] Cases CRUD API: GET/POST /api/cases, GET/PUT/DELETE /api/cases/:id (scoped to owner)
- [x] Shared zod validation (src/lib/case-schema.ts) used by form + API
- [x] Case Records dashboard UI with login/signup, stats, create/edit/delete
- [x] Assistant ↔ Case Records toggle in sidebar
- [x] End-to-end API test (signup → create → list → update → delete) + UI check
- [x] Give user: Postman test steps + screenshot checklist + GitHub note
