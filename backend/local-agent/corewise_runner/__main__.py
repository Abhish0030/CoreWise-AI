import argparse
import getpass
import json
import signal
import sys
from pathlib import Path

from .client import monitor, pair, run_paired
from .detection import detect
from .schema import Config
from .supervisor import execute


def main():
    parser = argparse.ArgumentParser(description="CoreWise allowlisted local runner; no listener")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("detect")
    monitoring = sub.add_parser("monitor")
    monitoring.add_argument("--samples", type=int, default=30)
    monitoring.add_argument("--interval", type=int, default=2)
    monitoring.add_argument(
        "--continuous",
        action="store_true",
        help="Explicitly monitor until Ctrl+C; never executes benchmarks",
    )
    monitoring.add_argument("--agent-id", help="Previously paired device ID in the native vault")
    collection = sub.add_parser("collect")
    collection.add_argument("--execute", action="store_true")
    collection.add_argument("--output-dir", type=Path, required=True)
    collection.add_argument("--include-fp64", action="store_true")
    pairing = sub.add_parser("pair")
    pairing.add_argument("--url", required=True)
    pairing.add_argument("--name", default="Local workstation")
    run = sub.add_parser("run")
    run.add_argument("--execute", action="store_true", help="Explicitly authorize one queued job")
    run.add_argument("--agent-id", help="Previously paired device ID in the native vault")
    local = sub.add_parser("local")
    local.add_argument("--execute", action="store_true")
    local.add_argument(
        "--workload",
        choices=[
            "VECTOR_ADDITION",
            "MATRIX_MULTIPLICATION",
            "SORTING",
            "REDUCTION",
            "IMAGE_PROCESSING",
        ],
        required=True,
    )
    local.add_argument("--size", type=int, required=True)
    local.add_argument("--cpu-only", action="store_true")
    local.add_argument("--repetitions", type=int, default=5)
    local.add_argument("--scope", choices=["COMPUTE_ONLY", "END_TO_END"], default="END_TO_END")
    local.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "detect":
            result = detect()
        elif args.command == "monitor":

            def terminate(_signum, _frame):
                raise KeyboardInterrupt

            signal.signal(signal.SIGTERM, terminate)
            result = monitor(args.samples, args.interval, args.continuous, args.agent_id)
        elif args.command == "pair":
            agent = pair(args.url, getpass.getpass("One-time pairing code: "), args.name)
            result = {
                "agentId": agent,
                "message": (
                    "Credential saved in OS vault; detected profile created and selected. "
                    "No monitoring or benchmark started."
                ),
            }
        else:
            if not args.execute:
                parser.error("Benchmark execution requires the explicit --execute flag")
            if args.command == "collect":
                from .collection import collect

                result = collect(args.output_dir, args.include_fp64)
            elif args.command == "run":
                result = run_paired(args.agent_id)
            else:
                config = Config(
                    workload=args.workload,
                    size=args.size,
                    gpu=not args.cpu_only,
                    repetitions=args.repetitions,
                    scope=args.scope,
                )
                result = execute(config.model_dump())
                if args.output:
                    args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        if result.get("status") in ["FAILED", "CANCELLED"]:
            return 1
    except Exception as exc:
        print(f"Runner error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
