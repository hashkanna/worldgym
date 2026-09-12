"""Optional: DINOv2 embedding endpoint on Modal, for a robust "same place?" similarity.

Deploy:   modal deploy modal_app.py
Then:     export WORLDGYM_EMBED_URL=https://<workspace>--worldgym-embed-embedder-embed.modal.run
metrics.similarity() will POST two JPEGs (multipart fields `a`, `b`) and blend the
cosine similarity into the composite score.

Untested in this repo (no Modal account in the sandbox); API names follow Modal's
current docs (modal.App, modal.fastapi_endpoint, image.imports). Treat as the
"if there's time" upgrade over ORB/SSIM -- ask Modal at the venue for credits.
"""

from __future__ import annotations

import modal

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "torch", "torchvision", "pillow", "numpy", "fastapi[standard]", "python-multipart"
)
app = modal.App("worldgym-embed", image=image)

with image.imports():
    import io

    import numpy as np
    import torch
    from fastapi import File, UploadFile
    from PIL import Image


@app.cls(gpu="T4", scaledown_window=300)
class Embedder:
    @modal.enter()
    def load(self) -> None:
        self.model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14").eval().cuda()

    def _embed(self, jpeg: bytes):
        im = Image.open(io.BytesIO(jpeg)).convert("RGB").resize((224, 224))
        x = torch.from_numpy(np.asarray(im)).permute(2, 0, 1).float().div(255)
        mean = torch.tensor([0.485, 0.456, 0.406]).view(3, 1, 1)
        std = torch.tensor([0.229, 0.224, 0.225]).view(3, 1, 1)
        x = ((x - mean) / std).unsqueeze(0).cuda()
        with torch.no_grad():
            f = self.model(x)
        return torch.nn.functional.normalize(f, dim=-1)[0]

    @modal.fastapi_endpoint(method="POST")
    async def embed(self, a: UploadFile = File(...), b: UploadFile = File(...)):
        ea, eb = self._embed(await a.read()), self._embed(await b.read())
        return {"cosine": float((ea * eb).sum().item())}
