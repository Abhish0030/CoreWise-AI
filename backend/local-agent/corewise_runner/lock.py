import os
import re
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def execution_lock(name="execution"):
    """One benchmark child per OS user, including separate CLI invocations."""
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", name):
        raise ValueError("Invalid lock name")
    root = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".config")) / "CoreWiseAI"
    root.mkdir(parents=True, exist_ok=True)
    with (root / f"{name}.lock").open("a+b") as handle:
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise ValueError(f"Another {name} collector or benchmark is already running") from exc
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
