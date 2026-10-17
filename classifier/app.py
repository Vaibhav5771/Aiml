"""
Recycling-Net-11, served.

WHY THIS EXISTS. Hugging Face's serverless inference does not carry
`prithivMLmods/Recycling-Net-11`: the model's `inferenceProviderMapping` is
empty and it appears in no hf-inference listing, so there is no URL to call and
an access token does not change that. `proxy/api/classifier.ts` was written
against that route and could never have succeeded. This is the route it calls
instead, and the only thing that moved on the proxy side is a URL.

WHAT IT GUARANTEES. One thing, and it is the whole reason this is a service
rather than a few lines of JavaScript: the image is preprocessed by the model's
own `SiglipImageProcessor`, loaded from the same repo as the weights. Nobody
reimplements a resize, a rescale factor or a normalisation constant, so the
tensor this model scores is the tensor it was trained on.

WHAT IT IS NOT. Not authoritative. `src/rules/` decides every verdict and cites
a municipal document for it. This produces one label and one number, and the
only power that evidence has downstream is to make the app refuse to answer.
"""

import io
import json
import os
import time

import torch
from fastapi import FastAPI, Header, HTTPException, Request
from PIL import Image, ImageOps
from transformers import AutoImageProcessor, AutoModelForImageClassification

# Pinned by name, matching `CLASSIFIER_MODEL` in `proxy/api/classifier.ts`.
# Which model produced a stored result has to be recoverable from git.
MODEL_ID = "prithivMLmods/Recycling-Net-11"

# Bumped whenever the model, the label set or the preprocessing changes,
# because all three change what a stored score meant. The proxy pins its own
# `CLASSIFIER_VERSION` for the label map; this covers the serving side, and
# `/health` reports it so a scan can be traced to the container that judged it.
SERVING_VERSION = "serve@v1"

# Refuse a body larger than this before decoding it. The app sends a 1568px
# JPEG, around 500KB, so anything near this ceiling is not our app.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

# Guard against a decompression bomb: a few hundred KB of JPEG can declare a
# gigapixel canvas and exhaust a free Space's memory on decode.
Image.MAX_IMAGE_PIXELS = 64_000_000

# A shared secret, set as a Space secret. A Space URL is public, and without
# this anyone who finds it can spend the CPU. Left unset the service stays
# open, so a first deploy works before the secret is added, and `/health` says
# plainly that it is unprotected.
TOKEN = os.environ.get("CLASSIFIER_TOKEN", "").strip()

# HOW A NON SQUARE PHOTO IS MADE SQUARE, and it is a judgement call worth
# knowing about rather than a detail.
#
# `SiglipImageProcessor` resizes to exactly 224x224 with no regard for aspect
# ratio, so a 4:3 phone photo reaches the model horizontally compressed by a
# quarter. `square` centre crops first, so the resize changes scale and never
# shape, which is also what the camera's framing guides already ask the user to
# set up. `none` passes the frame through and lets the processor squash it,
# which is what the model's own training script did.
#
# Which is better on OUR photos is unmeasured, and this is the switch that lets
# it be measured rather than argued about. The default is the one that does not
# distort the item.
CROP = os.environ.get("CLASSIFIER_CROP", "square").strip().lower()

# One thread beats four on a free Space: 2 vCPU with torch spawning a thread
# per core spends more time contending than computing on a single 224px image.
torch.set_num_threads(1)

processor = AutoImageProcessor.from_pretrained(MODEL_ID)
model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
model.eval()

# The label strings the proxy's `LABEL_TO_MATERIAL` is keyed on, read off the
# model rather than retyped here. A label this service invents is a label the
# proxy refuses, which is the behaviour we want and not one to recreate by hand.
LABELS = [model.config.id2label[i] for i in range(len(model.config.id2label))]

app = FastAPI(title="Recyclens classifier", version=SERVING_VERSION)


def _authorise(authorization):
    """Bearer check, or nothing at all when no secret is configured."""
    if not TOKEN:
        return
    if authorization != "Bearer " + TOKEN:
        raise HTTPException(status_code=401, detail="unauthorized")


def _to_square(image):
    """Centre crop to the largest square the frame holds. A no-op when square."""
    width, height = image.size
    edge = min(width, height)
    left = (width - edge) // 2
    top = (height - edge) // 2
    return image.crop((left, top, left + edge, top + edge))


def _prepare(raw):
    """
    Bytes to the image the processor should see.

    `exif_transpose` first, and it is load bearing rather than tidy: a phone
    holds the sensor in one orientation and records the real one in an EXIF
    tag. PIL reads the pixels, not the tag, so without this a photo taken in
    portrait reaches the model on its side, and a classifier judging a bottle
    lying down is being asked a different question than the one the user asked.
    """
    image = Image.open(io.BytesIO(raw))
    image = ImageOps.exif_transpose(image)
    # `convert` after the transpose, so a palette or CMYK source is normalised
    # once and the processor never has to guess at a channel count.
    image = image.convert("RGB")
    return _to_square(image) if CROP == "square" else image


@app.get("/health")
def health():
    """
    Enough to tell a healthy container from a wrong one without a photo.

    Also the endpoint to hit before a demo: a free Space sleeps, and this wakes
    it without spending a classification.
    """
    return {
        "ok": True,
        "model": MODEL_ID,
        "serving": SERVING_VERSION,
        "labels": LABELS,
        "crop": CROP,
        # The processor's own numbers, not ours, so a drift between this
        # container and the model repo is visible here rather than as a quietly
        # worse prediction.
        "preprocessing": {
            "size": processor.size,
            "resample": processor.resample,
            "rescale_factor": processor.rescale_factor,
            "image_mean": processor.image_mean,
            "image_std": processor.image_std,
        },
        "protected": bool(TOKEN),
    }


@app.post("/classify")
async def classify(request: Request, authorization: str = Header(default=None)):
    """
    One image in, the full 11 class distribution out.

    The body is raw image bytes with an `image/*` content type, which is the
    shape `proxy/api/classifier.ts` already sends, and the reply is a list of
    `{label, score}` with `score` a 0 to 1 probability. That is deliberately the
    hf-inference reply shape: the proxy's `parseClassification` reads it
    unchanged, and swapping this service for a paid Inference Endpoint later
    costs one environment variable and no code.

    The whole distribution travels, not just the top row. The proxy takes the
    best of it today, and keeping the rest means the margin between first and
    second is available to the learned stage later without redeploying this.
    """
    _authorise(authorization)

    content_type = request.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="expected an image/* body")

    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="empty body")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image too large")

    started_at = time.monotonic()

    try:
        image = _prepare(raw)
    except Exception:
        # A body that will not decode is a bad request, not a broken service.
        # The distinction matters: the proxy logs 4xx and 5xx the same way, but
        # a human reading those logs should not go looking at the model.
        raise HTTPException(status_code=400, detail="could not decode the image")

    inputs = processor(images=image, return_tensors="pt")

    with torch.inference_mode():
        logits = model(**inputs).logits

    # Softmax, because `problem_type` is single label classification and the
    # head emits raw logits. Reporting those as a score would hand the proxy a
    # number outside 0 to 1 that it would be right to reject.
    probabilities = torch.softmax(logits[0], dim=-1).tolist()

    rows = [
        {"label": label, "score": float(score)}
        for label, score in zip(LABELS, probabilities)
    ]
    rows.sort(key=lambda row: row["score"], reverse=True)

    # One line per request, matching how the proxy logs. Never the image.
    print(
        json.dumps(
            {
                "at": "classify",
                "label": rows[0]["label"],
                "score": round(rows[0]["score"], 4),
                "ms": int((time.monotonic() - started_at) * 1000),
            }
        ),
        flush=True,
    )

    return rows
