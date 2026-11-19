import math

import pytest

from corewise_ml.knowledge import DIMENSION, EmbeddingRequest, embed, validate_vector


def test_vector_validation_rejects_wrong_dimensions_and_nonfinite():
    for values in [[1], [0] * DIMENSION, [math.inf] * DIMENSION, [math.nan] * DIMENSION]:
        with pytest.raises(ValueError):
            validate_vector(values)
    assert len(validate_vector([1] * DIMENSION)) == DIMENSION


def test_bounded_chunking_and_model_metadata(monkeypatch):
    class Tokenizer:
        def __call__(self, text, **_kwargs):
            return {
                "input_ids": list(range(len(text))),
                "offset_mapping": [(i, i + 1) for i in range(len(text))],
            }

    class Encoder:
        tokenizer = Tokenizer()

        def encode(self, chunks, **_kwargs):
            return [[1] + [0] * (DIMENSION - 1) for _ in chunks]

    monkeypatch.setattr("corewise_ml.knowledge.model", lambda: Encoder())
    result = embed(EmbeddingRequest(text="A" * 300, mode="document"))
    assert result["chunks"][0]["text"] == "A" * 192
    assert len(result["chunks"]) == 2 and result["dimension"] == 384
    assert result["chunks"][1]["text"] == "A" * 140
    with pytest.raises(ValueError, match="query"):
        embed(EmbeddingRequest(text="A" * 300, mode="query"))
    with pytest.raises(ValueError, match="budget"):
        embed(EmbeddingRequest(text="A" * 12000, mode="document"))
