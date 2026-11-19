"""Pinned CPU-only sentence embeddings. Groq never generates vectors."""

import hashlib
import math
import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MODEL = "sentence-transformers/all-MiniLM-L6-v2"
REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
DIMENSION = 384
LOCK = threading.Lock()


class EmbeddingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=24000)
    mode: Literal["document", "query"]


@lru_cache(maxsize=1)
def model():
    import torch
    from sentence_transformers import SentenceTransformer

    torch.set_num_threads(1)
    result = SentenceTransformer(
        MODEL,
        revision=REVISION,
        device="cpu",
        trust_remote_code=False,
        cache_folder=str(
            Path(os.getenv("ML_EMBEDDING_CACHE", "backend/ml/embedding-cache")).resolve()
        ),
        local_files_only=os.getenv("COREWISE_EMBEDDING_DOWNLOAD") != "1",
    )
    if result.get_embedding_dimension() != DIMENSION:
        raise ValueError("Embedding model dimension mismatch")
    return result


def validate_vector(vector):
    values = [float(x) for x in vector]
    if len(values) != DIMENSION or not all(math.isfinite(x) for x in values):
        raise ValueError("Invalid embedding dimension or numeric value")
    if sum(x * x for x in values) < 1e-12:
        raise ValueError("Zero embedding is not searchable")
    return values


def embed(request):
    if not LOCK.acquire(blocking=False):
        raise RuntimeError("Embedding service is busy; retry later")
    try:
        encoder = model()
        encoded = encoder.tokenizer(
            request.text,
            add_special_tokens=False,
            return_offsets_mapping=True,
            truncation=False,
            verbose=False,
        )
        tokens = encoded["input_ids"]
        offsets = encoded["offset_mapping"]
        if not tokens:
            raise ValueError("Text must contain searchable tokens")
        if request.mode == "query":
            if len(tokens) > 192:
                raise ValueError("Search query exceeds the embedding token budget")
            chunks = [request.text]
        else:
            chunks = [
                request.text[offsets[i][0] : offsets[min(i + 192, len(tokens)) - 1][1]]
                for i in range(0, len(tokens), 160)
            ]
        if not chunks or len(chunks) > 64:
            raise ValueError("Document exceeds the bounded chunk budget")
        vectors = encoder.encode(
            chunks,
            batch_size=16,
            normalize_embeddings=True,
            show_progress_bar=False,
            convert_to_numpy=True,
        )
        return {
            "model": MODEL,
            "revision": REVISION,
            "dimension": DIMENSION,
            "chunks": [
                {
                    "text": text,
                    "embedding": validate_vector(vector),
                    "contentHash": hashlib.sha256(text.encode()).hexdigest(),
                }
                for text, vector in zip(chunks, vectors, strict=True)
            ],
        }
    finally:
        LOCK.release()


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv(".env")
    os.environ["COREWISE_EMBEDDING_DOWNLOAD"] = "1"
    model()
    print("Pinned 384-dimensional CPU embedding model cached and ready.")
