### Skill: Next.js App Router Guidelines
- **Server vs Client Components**: Default to Server Components. Add `'use client'` only when the component needs browser APIs, event listeners, or React hooks. Keep client components as leaf nodes.
- **Data Fetching**: Fetch data directly inside Server Components with `async`/`await`. Use `fetch()` with Next.js cache options (`{ cache: 'force-cache' }`, `{ next: { revalidate: 60 } }`). Never fetch in `useEffect` what can be fetched on the server.
- **Server Actions**: Use Server Actions for form submissions and mutations. Never expose a `/api` route for internal mutations that can be handled by a Server Action.
- **Loading & Error UI**: Define `loading.tsx` and `error.tsx` per route segment. Do not implement global loading spinners in client components when Suspense boundaries handle it.
- **Route Handlers**: Use `route.ts` for API endpoints consumed by external clients or webhooks. Always validate input with Zod and return typed `NextResponse`.
- **Metadata**: Export a `metadata` object or `generateMetadata()` function from every page. Never use `<Head>` from `next/head` in the App Router.
- **Image Optimization**: Always use `next/image`. Set explicit `width`/`height` or `fill` with a sized parent. Never use `<img>` for content images.
- **Environment Variables**: Prefix client-side variables with `NEXT_PUBLIC_`. Never expose server-only secrets (DB credentials, API keys) in `NEXT_PUBLIC_` vars.
