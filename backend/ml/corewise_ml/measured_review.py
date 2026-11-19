"""Review measured CSV with reproducible grouped fitting, without registry mutation."""

import argparse
import hashlib
import json
from pathlib import Path

from .datasets import validate_csv
from .schema import TrainingConfig
from .training import train


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = validate_csv(args.csv.read_text(encoding="utf-8"))
    if any(row["provenance"] != "MEASURED" for row in rows):
        raise ValueError("Measured review requires exclusively measured labels")
    args.output.mkdir(parents=True, exist_ok=False)
    config = TrainingConfig(seed=42, group_by="CONFIGURATION")
    models = train(rows, config, args.output, log=lambda line: print(line, flush=True))
    report = {
        "sourceSha256": hashlib.sha256(args.csv.read_bytes()).hexdigest(),
        "provenance": "MEASURED",
        "rowCount": len(rows),
        "config": config.model_dump(),
        "models": models,
        "limitations": [
            "One CPU/GPU system, small inputs and one CPU thread only.",
            "Repeated configurations remain in disjoint grouped splits.",
            "Validation RMSE selects the model before held-out evaluation.",
            "Independent empirical calibration is not vendor peak capability.",
            "No model is activated or existing artifact overwritten by this review.",
        ],
    }
    (args.output / "evaluation.json").write_text(
        json.dumps(report, indent=2, allow_nan=False), encoding="utf-8"
    )
    print(
        json.dumps(
            [
                {
                    "target": m["target"],
                    "algorithm": m["algorithm"],
                    "selected": m["selected"],
                    "test": m["evaluation"]["test"],
                    "validation": m["evaluation"]["validation"],
                }
                for m in models
            ]
        )
    )


if __name__ == "__main__":
    main()
