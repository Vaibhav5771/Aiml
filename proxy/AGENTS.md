# Vision proxy

## Overview

One serverless function that stands between the phone and Google Gemini. It exists for a single reason, set by spec 0001: the Gemini key lives here and never ships inside the app, because anything inside an installable app can be pulled back out of it.

This is **not** React Native. It runs on Vercel's Node runtime as its own deployable project, with its own `package.json` and `tsconfig.json`. Nothing in `src/` may import from here, and nothing here may import from `src/`.

## Key files

| File | Owns |
|---|---|
| `api/vision.ts` | The whole function: request validation, the Gemini call, and the response contract |
| `vercel.json` | The function timeout. See Gotchas, this is the risk in the design |
| `.env.example` | The one variable this needs, `GEMINI_API_KEY` |

## Commands

```bash
npm install            # from inside proxy/
npm run typecheck      # tsc --noEmit
vercel                 # first deploy, links the project
vercel --prod          # production deploy
```

Set the Vercel project's **root directory to `proxy`**, so Vercel never tries to build the Expo app as a website.

## Conventions

- **The contract is fixed by spec 0001 and the app depends on it.** `POST { image: "<base64 jpeg>", mimeType: "image/jpeg" }` returns either `200 { attributes: {...} }` or a non 200 `{ error: "<machine readable code>" }`. Never a partial result, and never a 200 carrying an error.
- Error codes are machine readable strings, never prose. The app switches on them to pick a failure screen, so renaming one is a breaking change.
- Validate the request before doing anything expensive. A bad request should never reach Gemini and cost a call.
- Validate Gemini's response against the attribute schema before returning it. A malformed model response is an error, not something to pass through to the app.
- The handler is a pure request to response function with no module level mutable state. Serverless instances are reused between invocations, so anything you keep at module scope leaks across requests.
- `GEMINI_API_KEY` is read from the environment and never logged, never returned in an error body, and never committed. `.env` is gitignored.

## Gotchas

- **The function timeout is the real risk in this whole design.** A Gemini vision call on a large photo can take several seconds, and the default is short. `vercel.json` asks for `maxDuration: 60`, but that has not been confirmed against the free tier yet. Check it before building anything heavier on top. If 60 seconds is not available, spec 0001 names the fallback and what it costs you.
- The app resizes photos to roughly a 1568px long edge before sending, so a request body should land near 500KB once base64 encoded. A much larger body means the app side resize did not run.
- Feature 3 owns the attribute vocabulary and the prompt. Until it lands, the handler validates the request and returns `501 not_implemented` on purpose. Do not invent an attribute schema here; that decision belongs to feature 3.

## Agent skills

- [gemini-api-dev](../.agents/skills/gemini-api-dev/): `google-gemini/gemini-skills`, the Gemini TypeScript SDK, structured output and image input. Note the package is `@google/genai` 2.3.0 or newer; the widely tutorialized `@google/generative-ai` is deprecated.

## Related specs

- [spec 0001](../docs/specs/0001-stack-and-architecture/index.md): why this proxy exists, and the contract it has to honour.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
