# Project rules

- Preserve the existing marketplace and external Node API during correction work; a framework or backend migration is a separate task because it risks unrelated customer workflows.
- Reuse the search listing card for home listings so prices, seller details and contact actions use one presentation contract.
- Keep correction acceptance rules in runnable tests and distinguish local source verification from external deployment and authenticated acceptance.
- Share dynamic-detail HTML rendering between the existing Node server and hosting handlers for every visitor; this keeps canonical URLs, status codes and initial content consistent without changing the marketplace framework.
- api/* relative imports must end in .js — Vercel runs them as native ES modules and crashes otherwise.
- Clerk is mounted only through components/auth/ClerkIsland (lazy, rule in utils/clerkLoad.ts); never wrap the whole app in ClerkProvider — it downloads ~250 KB on every visit.
- All image uploads (listings, avatars, admin content) go through the single /api/uploads pipeline (Multer + Sharp → local /uploads/); databases store URLs, never bytes. users.avatar_url is stored as a relative "/uploads/<file>" path; the admin avatar endpoint normalizes absolute URLs back to that form.
- Load socket.io-client lazily via ensureSocketLib() (services/conversationsApi.ts), never statically — anonymous visitors must not download it (PageSpeed first-load size).
