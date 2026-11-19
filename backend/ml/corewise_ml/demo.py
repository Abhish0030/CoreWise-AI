"""Reproducible local artifacts for review; never registers/activates user models."""

import argparse
import csv
import json
from pathlib import Path

from .datasets import generate
from .schema import TrainingConfig
from .training import train


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=1200)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if not 120 <= args.count <= 5000:
        parser.error("count must be between 120 and 5000")
    root = Path("backend/ml/artifacts/reference-demo")
    root.mkdir(parents=True, exist_ok=True)
    rows = generate(args.count, args.seed)
    with (root / "dataset.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=rows[0])
        writer.writeheader()
        writer.writerows(rows)
    models = train(rows, TrainingConfig(seed=args.seed), root, print)
    (root / "evaluation.json").write_text(
        json.dumps(
            {
                "count": args.count,
                "seed": args.seed,
                "provenance": "SYNTHETIC_DEMO",
                "models": models,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    for model in models:
        print(
            model["target"],
            model["algorithm"],
            "selected=" + str(model["selected"]),
            json.dumps(model["evaluation"]["test"]),
        )


if __name__ == "__main__":
    main()
