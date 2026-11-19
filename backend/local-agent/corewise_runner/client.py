import hashlib
import json
import os
import sys
import time
from pathlib import Path
from threading import Event
from urllib.parse import urlsplit

import httpx
import keyring

from .detection import detect
from .lock import execution_lock
from .supervisor import execute

SERVICE = "CoreWiseAI Local Runner"


class BackendError(ValueError):
    def __init__(self, status, retry_after=0):
        super().__init__(f"Backend returned HTTP {status}")
        self.status = status
        self.retry_after = retry_after


def validate_origin(origin):
    url = urlsplit(origin)
    if url.username or url.password or url.query or url.fragment or url.path not in ["", "/"]:
        raise ValueError("Use an origin only, without credentials, path or query")
    if url.scheme != "https" and not (
        url.scheme == "http" and url.hostname in ["127.0.0.1", "localhost", "::1"]
    ):
        raise ValueError("Remote backend connections require HTTPS; HTTP is loopback-only")
    if not url.hostname:
        raise ValueError("Backend hostname is required")
    return origin.rstrip("/")


class Backend:
    def __init__(self, origin):
        self.origin = validate_origin(origin)
        self.client = httpx.Client(base_url=self.origin, timeout=15, follow_redirects=False)

    def request(self, path, data=None, token=None):
        headers = {}
        method = "GET" if data is None else "POST"
        if data is not None:
            csrf = self.client.get("/api/auth/csrf")
            csrf.raise_for_status()
            headers["x-csrf-token"] = csrf.json()["data"]["token"]
        if token:
            headers["Authorization"] = "Bearer " + token
        response = self.client.request(method, path, json=data, headers=headers)
        if not response.is_success:
            try:
                retry_after = min(60, max(0, float(response.headers.get("retry-after", "0"))))
            except ValueError:
                retry_after = 0
            raise BackendError(response.status_code, retry_after)
        return response.json()["data"]

    def close(self):
        self.client.close()


def secure_keyring():
    backend = keyring.get_keyring()
    module = type(backend).__module__
    if not module.startswith(
        (
            "keyring.backends.Windows",
            "keyring.backends.macOS",
            "keyring.backends.SecretService",
            "keyring.backends.kwallet",
        )
    ):
        raise ValueError(
            "A supported OS credential vault is required; plaintext storage is refused"
        )
    return backend


def metadata_path():
    root = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".config")) / "CoreWiseAI"
    root.mkdir(parents=True, exist_ok=True)
    return root / "runner.json"


def load_device(agent_id=None):
    path = metadata_path()
    if not path.exists():
        raise ValueError("Pair this computer first using the signed-in account's one-time code")
    config = json.loads(path.read_text(encoding="utf-8"))
    if agent_id:
        devices = config.get("devices", [config])
        config = next((d for d in devices if d["agentId"] == agent_id), None)
        if config is None:
            raise ValueError("Requested device is not paired in this OS user's native vault")
    return {"origin": validate_origin(config["origin"]), "agentId": config["agentId"]}


def pair(origin, code, name):
    secure_keyring()  # Fail before consuming the one-time code if secure storage is unavailable.
    backend = Backend(origin)
    try:
        result = backend.request(
            "/api/agent/redeem",
            {"code": code, "name": name, "environment": detect(), "registerHardware": True},
        )
        account = f"{backend.origin}|{result['agentId']}"
        keyring.set_password(SERVICE, account, result["token"])
        path = metadata_path()
        previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        devices = previous.get("devices", [load_device()]) if previous else []
        current = {"origin": backend.origin, "agentId": result["agentId"]}
        devices = [d for d in devices if d["agentId"] != current["agentId"]] + [current]
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps({**current, "devices": devices}), encoding="utf-8")
        temporary.replace(path)
        return result["agentId"]
    finally:
        backend.close()


def run_paired(agent_id=None):
    secure_keyring()
    config = load_device(agent_id)
    backend = Backend(config["origin"])
    token = keyring.get_password(SERVICE, f"{backend.origin}|{config['agentId']}")
    if not token:
        raise ValueError("Runner credential missing from the OS vault; pair again")
    try:
        backend.request("/api/agent/session", {}, token)
        job = backend.request("/api/agent/claim", {})
        if job is None:
            return {"status": "IDLE", "message": "No queued benchmark. Queue one in Benchmark Lab."}
        last_poll = 0.0

        def cancelled():
            nonlocal last_poll
            if time.monotonic() - last_poll < 1:
                return False
            last_poll = time.monotonic()
            status = backend.request(f"/api/agent/jobs/{job['id']}")["status"]
            return status in ["CANCEL_REQUESTED", "CANCELLED"]

        result = execute(job["config"], cancelled)
        backend.request(f"/api/agent/jobs/{job['id']}/result", result)
        return {"jobId": job["id"], "status": result["status"]}
    finally:
        backend.close()


def monitor(samples=30, interval=2, continuous=False, agent_id=None, stop=None):
    if not 1 <= interval <= 10 or (
        not continuous and (not 1 <= samples <= 120 or samples * interval > 300)
    ):
        raise ValueError(
            "Telemetry requires 1–120 samples, 1–10 second interval and at most 300 seconds"
        )
    from .telemetry import sample

    secure_keyring()
    config = load_device(agent_id)
    backend = Backend(config["origin"])
    token = keyring.get_password(SERVICE, f"{backend.origin}|{config['agentId']}")
    if not token:
        raise ValueError("Pair this runner first; no credential found in the native vault")
    uploaded = 0
    stop = stop or Event()
    lock_name = (
        "telemetry-"
        + hashlib.sha256(f"{backend.origin}|{config['agentId']}".encode()).hexdigest()[:24]
    )
    try:
        with execution_lock(lock_name):
            deadline = float("inf") if continuous else time.monotonic() + 300
            authenticated, failures = False, 0
            print(f"Monitoring paired device {config['agentId']}; Ctrl+C to stop.", file=sys.stderr)
            while not stop.is_set() and (continuous or uploaded < samples):
                if time.monotonic() >= deadline:
                    break
                try:
                    if not authenticated:
                        backend.request("/api/agent/session", {}, token)
                        authenticated = True
                    backend.request("/api/agent/telemetry", sample())
                    uploaded += 1
                    failures = 0
                    if not continuous and uploaded >= samples:
                        break
                    delay = interval
                except (httpx.TransportError, BackendError) as exc:
                    if not continuous:
                        raise
                    if isinstance(exc, BackendError):
                        if exc.status == 401 and authenticated:
                            # Refresh an expired runner session once. A revoked vault
                            # credential fails the following authentication and stops.
                            authenticated = False
                        elif exc.status != 429 and exc.status < 500:
                            raise
                    failures += 1
                    delay = min(30, 2 ** min(failures, 5))
                    if isinstance(exc, BackendError):
                        delay = max(delay, exc.retry_after)
                    print(
                        f"Telemetry disconnected; retry in {delay:g}s; no samples queued.",
                        file=sys.stderr,
                    )
                stop.wait(min(delay, max(0, deadline - time.monotonic())))
    except KeyboardInterrupt:
        stop.set()
    finally:
        backend.close()
    return {
        "status": "STOPPED" if continuous or stop.is_set() else "COMPLETED",
        "samples": uploaded,
        "message": "Sampling stopped. Dashboard becomes stale after 15 seconds.",
    }
