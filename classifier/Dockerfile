# The second opinion, as its own service.
#
# Hugging Face serves no provider for `prithivMLmods/Recycling-Net-11`
# (`inferenceProviderMapping` is empty and it appears in no hf-inference
# listing), so there is no serverless URL to call and a token does not change
# that. This image is the answer: the real fp32 model, its own processor, and
# nothing else, on a free CPU Space.
#
# Targets a Hugging Face Space with `sdk: docker`, which runs the container as
# UID 1000 and expects the app on port 7860. Both are set below.

FROM python:3.11-slim

# `libgomp1` is torch's OpenMP runtime. The slim image omits it and the import
# fails at startup rather than at build, which is the worst place to find out.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libgomp1 \
  && rm -rf /var/lib/apt/lists/*

# A Space runs as this user. Writing the cache anywhere root owns makes the
# model download fail at runtime with a permission error.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1

WORKDIR $HOME/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# THE WEIGHTS ARE BAKED IN, at build time, on purpose.
#
# A free Space sleeps after inactivity and cold starts from this image. Pulling
# 372MB from the hub on every wake would put 30 seconds in front of the first
# scan of the day, well past the proxy's 8 second classifier budget, so the
# first scan would silently get no second opinion every single time. Downloaded
# here, a cold start is a disk read.
RUN python -c "\
from transformers import AutoImageProcessor, AutoModelForImageClassification; \
m = 'prithivMLmods/Recycling-Net-11'; \
AutoImageProcessor.from_pretrained(m); \
AutoModelForImageClassification.from_pretrained(m)"

COPY --chown=user app.py .

# 7860 is the Hugging Face Space convention and the default here. Cloud Run,
# and most other hosts, inject their own `PORT` instead and ignore EXPOSE
# entirely, so the port is read at runtime rather than baked in. Shell form on
# purpose: exec form does no variable expansion, so `$PORT` would reach uvicorn
# as the literal string and the container would die on startup.
ENV PORT=7860
EXPOSE 7860
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT}
