import multiprocessing as mp
import queue
import time

from .benchmarks import measure
from .lock import execution_lock
from .schema import Config


def _child(config, output):
    try:
        output.put({"status": "COMPLETED", "measurement": measure(config)})
    except Exception as exc:
        output.put({"status": "FAILED", "error": f"{type(exc).__name__}: {str(exc)[:1500]}"})


def execute(config: dict, cancelled=lambda: False):
    with execution_lock():
        return _execute(config, cancelled)


def _execute(config: dict, cancelled):
    config = Config.model_validate(config).model_dump()
    context = mp.get_context("spawn")
    output = context.Queue(maxsize=1)
    process = context.Process(target=_child, args=(config, output))
    process.start()
    deadline = time.monotonic() + config["timeoutSeconds"]
    try:
        while True:
            if cancelled():
                return {"status": "CANCELLED", "error": "Cancelled by owner"}
            if time.monotonic() >= deadline:
                return {"status": "FAILED", "error": "Execution timeout; child terminated"}
            try:
                return output.get(timeout=0.1)
            except queue.Empty:
                if not process.is_alive():
                    return {"status": "FAILED", "error": "Benchmark child exited without a result"}
    except KeyboardInterrupt:
        return {"status": "CANCELLED", "error": "Cancelled locally with Ctrl+C"}
    finally:
        if process.is_alive():
            process.terminate()
        process.join(timeout=5)
        if process.is_alive():
            process.kill()
            process.join(timeout=5)
        output.close()
