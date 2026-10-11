# Recyclens vision proxy

One serverless function that sits between the phone and Gemini.

## Why it exists

Spec 0001 put it here for a single reason: the Gemini key lives on the server,
not inside the app. Anything shipped in an installable app can be pulled back
out of it, and an academic project is usually submitted with its source.

## Deploying

This folder is its own Vercel project. In the Vercel dashboard set the root
directory to `proxy`, so Vercel never tries to build the Expo app as a website.

```bash
npm i -g vercel
cd proxy
vercel            # first deploy, links the project
vercel --prod     # production deploy
```

Then set `GEMINI_API_KEY` as an environment variable in the Vercel project
settings, and put the resulting function URL into the app's `.env` as
`EXPO_PUBLIC_PROXY_URL`.

## The one risk worth checking first

`vercel.json` asks for `maxDuration: 60`. A Gemini vision call on a large photo
can take several seconds, and the default function timeout is short. Confirm
your plan actually allows 60 seconds before you build much on top of this. If
it does not, spec 0001 names the fallback and its cost.

## Contract

```
POST  { "image": "<base64 jpeg>", "mimeType": "image/jpeg" }
200   { "itemName": "...", "note": "...", "attributes": { ...six } }
4xx   { "error": "<machine readable code>" }
```

Never a partial result. Spec 0003 defines the six attribute vocabulary in
`api/schema.ts` and fills in the Gemini call, so every failure arrives as one
of eleven machine readable codes the app switches on.
