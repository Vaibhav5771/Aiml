# The classifier service

`prithivMLmods/Recycling-Net-11` behind an HTTP endpoint, so `proxy/api/classifier.ts` has somewhere to call.

## Why this is here and not on Hugging Face's inference API

`proxy/api/classifier.ts` was written against `router.huggingface.co/hf-inference/models/...`, and that route cannot work for this model:

```bash
curl -s "https://huggingface.co/api/models/prithivMLmods/Recycling-Net-11?expand[]=inferenceProviderMapping"
# -> "inferenceProviderMapping": {}
```

No provider serves it, and no waste or recycling classifier is served there at all, so there is no drop-in model to swap to either. A token does not change this: the call returns `Model not supported` rather than a classification. The model is a cold community upload, which is exactly the kind HF's serverless tier stopped carrying.

So it runs on hardware you control instead — the real fp32 weights with their own processor.

## Where to run it

Three options. They all serve the same `app.py`, and the proxy only ever learns a URL, so moving between them costs one environment variable and no code.

| | Cost | Always on? | Setup |
|---|---|---|---|
| **Cloud Run** — what this build uses | free at this volume | yes, a permanent URL that scales to zero | the `Dockerfile` here |
| **Colab + tunnel** | free, no card | no — the URL moves each session, and Colab drops the runtime after ~90 min idle | [`colab.ipynb`](colab.ipynb) |
| **HF Space** | needs a paid HF plan | yes | the `Dockerfile` here |

The model needs about **700MB resident**, measured rather than guessed, which is
what rules out every 512MB free tier (Render, Koyeb) unless it is quantised
first. Cloud Run is given 2GiB.

### Cloud Run, what this build actually runs on

```bash
gcloud run deploy recyclens-classifier   --source classifier --region asia-south1   --memory 2Gi --cpu 1 --timeout 120   --min-instances 0 --max-instances 3   --allow-unauthenticated   --set-env-vars CLASSIFIER_TOKEN=<secret>,CLASSIFIER_CROP=square
```

Three of those flags are decisions rather than defaults:

- `--min-instances 0` means it costs nothing when nobody is scanning, and pays
  for that with a cold start on the first scan after a quiet spell. MEASURED,
  not estimated: a request to a scaled-to-zero service answered 200 in **30.2
  seconds**, against the proxy's 8 second classifier budget. So the first scan
  after idle reliably gets a Gemini-only answer, and roughly 25 minutes of
  quiet is enough to scale back to zero. Warm it before a demo:
  `curl https://<host>/health`. A warm call is 0.8s.

  If that is not acceptable, `--min-instances 1` removes it and starts billing
  an idle instance around the clock; nothing else in this design needs to
  change for that.
- `--max-instances 3` is a cost ceiling, not a capacity estimate. The free tier
  is generous but not infinite, and an unbounded service is an unbounded bill.
- `--allow-unauthenticated` because the caller is a Vercel function holding our
  own bearer token, not a Google identity. `app.py` does the authentication;
  Google's IAM layer would reject the proxy outright.

**A free Hugging Face Space will not work.** Free CPU hardware has no hourly cost, but [HF's own hardware docs](https://huggingface.co/docs/hub/spaces-gpus) say plainly: *"CPU Basic has no hourly cost, but creating a new Space that runs on compute (Gradio or Docker) requires a paid plan. Static Spaces are free for everyone."* A static Space cannot run a model, so Docker it would have to be, and Docker needs the plan.

### Colab, the free path

Open [`colab.ipynb`](colab.ipynb) in Google Colab, run it top to bottom, and it prints the two environment variables to paste into Vercel. It uploads `app.py` from this folder rather than carrying its own copy, so the notebook and a real deploy can never serve different preprocessing.

The notebook also has the crop experiment in its last cell, which is the one cheap measurable result in this feature and worth having in the write-up.

### A Space, if you have the plan

1. Create a Space: <https://huggingface.co/new-space> — **SDK: Docker**, **Hardware: CPU basic**.
2. Put **three files and only three** into it: `Dockerfile`, `app.py`, `requirements.txt`.

   **Do not upload this README.** When you create a Docker Space, Hugging Face writes its own `README.md` carrying the YAML frontmatter that tells it `sdk: docker` and which port to expose. Overwriting that removes the frontmatter and the Space stops being a Docker Space. Leave the generated one alone.

   Either drag the three files into **Files → Add file → Upload files**, which needs nothing installed, or push them with git:

   ```bash
   git clone https://huggingface.co/spaces/<you>/<space-name> space && cd space
   cp ../classifier/Dockerfile ../classifier/app.py ../classifier/requirements.txt .
   git add Dockerfile app.py requirements.txt
   git commit -m "Serve Recycling-Net-11"
   git push
   ```

   Git asks for a username and a password: the username is your HF username, the password is a **write** token from <https://huggingface.co/settings/tokens>, never your account password.

3. The first build takes 5–10 minutes, most of it baking the weights into the image. Watch it under **Logs**.
4. Settings → *Variables and secrets* → add `CLASSIFIER_TOKEN`, any long random string. Until you do, the endpoint is open to anyone who finds the URL.

## Wiring the proxy

Whichever host, set these in the Vercel project and **redeploy**:

```
CLASSIFIER_URL=https://<host>/classify
CLASSIFIER_TOKEN=<the same string>
```

`HF_TOKEN` is no longer read by anything and can be removed.

Then check the model alone, with no proxy and no Gemini quota spent:

```bash
CLASSIFIER_URL=... CLASSIFIER_TOKEN=... npm run check:classifier -- some-photo.jpg
```

With no `CLASSIFIER_URL` set, the proxy skips the classifier and returns exactly the read Gemini alone produces. The app is then no worse off than it was before any of this existed, which is the behaviour spec 0005 AC-6 requires.

## Checking a host is healthy

```bash
curl https://<host>/health
```

A healthy reply names the model, the 11 labels and the processor's own numbers (`size: {height: 224, width: 224}`, `image_mean: [0.5, 0.5, 0.5]`), read off the processor rather than retyped, so a container serving the wrong thing is visible here rather than as a quietly worse prediction.

## What it does to the image

The model's `preprocessor_config.json` resizes to exactly 224×224 with no regard for aspect ratio, so a 4:3 phone photo would reach it compressed by a quarter horizontally. Two steps run before the processor sees the frame:

| Step | Why |
|---|---|
| EXIF transpose | A phone records orientation in a tag rather than in the pixels. Without this a portrait photo is classified on its side. |
| Centre crop to square | So the processor's resize changes scale and never shape. The camera's framing guides already ask the user to fill the frame, which is the assumption this rests on. |

The crop is a judgement call, not a fact, and it is unmeasured on your photos. Set `CLASSIFIER_CROP=none` to turn it off and send the squashed full frame instead, which is what the model's own training script did. The notebook's last cell runs both ways.

## Cold starts are normal

The proxy gives the classifier 8 seconds and treats a slow one as "no second opinion", so a scan that arrives while the host is waking gets a Gemini-only answer and the next one is fine. That is the designed failure, not a bug, and it has been seen in the real app: a scan taken after about 25 minutes idle showed no second opinion row, and the Cloud Run log for it reads `200 30.155874877s`. The verdict itself was unaffected.

Before a demo, wake it: `curl https://<host>/health`.

## Files

| File | Owns |
|---|---|
| `app.py` | The two endpoints, the preprocessing, the bearer check. Every host runs this one file. |
| `colab.ipynb` | The free path: serves `app.py` from Colab behind a tunnel, plus the crop experiment |
| `Dockerfile` | The image, and baking the weights in at build time so a cold start is a disk read |
| `requirements.txt` | Pinned versions, CPU-only torch |
