from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple

try:
    import keyring  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    keyring = None  # type: ignore


SERVICE_NAME = "smithy"
DEFAULT_VAULT_PATH = Path.home() / ".smithy" / "credentials.json"


@dataclass
class SecretRecord:
    name: str
    value: str
    source: str  # env|keyring|file


class SecretsBackend:
    def get(self, name: str) -> Optional[str]:
        raise NotImplementedError

    def set(self, name: str, value: str) -> None:
        raise NotImplementedError

    def delete(self, name: str) -> None:
        raise NotImplementedError

    def list(self) -> Dict[str, str]:
        raise NotImplementedError


class EnvBackend(SecretsBackend):
    def __init__(self, env_path: Optional[Path] = None) -> None:
        self.env_path = env_path

    def _load_env_file(self) -> Dict[str, str]:
        data: Dict[str, str] = {}
        if self.env_path and self.env_path.exists():
            for line in self.env_path.read_text().splitlines():
                if not line.strip() or line.strip().startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    data[k.strip()] = v.strip()
        return data

    def _write_env_file(self, data: Dict[str, str]) -> None:
        if not self.env_path:
            return
        lines = [f"{k}={v}" for k, v in data.items()]
        self.env_path.parent.mkdir(parents=True, exist_ok=True)
        self.env_path.write_text("\n".join(lines) + "\n")

    def get(self, name: str) -> Optional[str]:
        if name in os.environ:
            return os.environ[name]
        file_vars = self._load_env_file()
        return file_vars.get(name)

    def set(self, name: str, value: str) -> None:
        # update process env
        os.environ[name] = value
        # update file
        file_vars = self._load_env_file()
        file_vars[name] = value
        self._write_env_file(file_vars)

    def delete(self, name: str) -> None:
        os.environ.pop(name, None)
        file_vars = self._load_env_file()
        if name in file_vars:
            file_vars.pop(name)
            self._write_env_file(file_vars)

    def list(self) -> Dict[str, str]:
        data = self._load_env_file()
        for k, v in os.environ.items():
            if k in data:
                continue
            if any(k.startswith(prefix) for prefix in ("OPENAI_", "PINECONE_", "GEMINI_", "DEEPSEEK_", "LITELLM_")):
                data[k] = v
        return data


class KeyringBackend(SecretsBackend):
    def __init__(self, service: str = SERVICE_NAME) -> None:
        self.service = service

    def get(self, name: str) -> Optional[str]:
        if not keyring:
            return None
        try:
            return keyring.get_password(self.service, name)  # type: ignore[attr-defined]
        except Exception:
            return None

    def set(self, name: str, value: str) -> None:
        if not keyring:
            return
        keyring.set_password(self.service, name, value)  # type: ignore[attr-defined]

    def delete(self, name: str) -> None:
        if not keyring:
            return
        try:
            keyring.delete_password(self.service, name)  # type: ignore[attr-defined]
        except Exception:
            pass

    def list(self) -> Dict[str, str]:
        # keyring doesn't support listing without specific backend APIs; return empty
        return {}


class FileBackend(SecretsBackend):
    def __init__(self, path: Path = DEFAULT_VAULT_PATH) -> None:
        self.path = path

    def _load(self) -> Dict[str, str]:
        if self.path.exists():
            try:
                return json.loads(self.path.read_text())
            except Exception:
                return {}
        return {}

    def _save(self, data: Dict[str, str]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(data, indent=2))

    def get(self, name: str) -> Optional[str]:
        return self._load().get(name)

    def set(self, name: str, value: str) -> None:
        data = self._load()
        data[name] = value
        self._save(data)

    def delete(self, name: str) -> None:
        data = self._load()
        if name in data:
            data.pop(name)
            self._save(data)

    def list(self) -> Dict[str, str]:
        return self._load()


class SecretsManager:
    """Unified secrets manager with multiple backends and guardrails."""

    def __init__(
        self,
        env_backend: Optional[EnvBackend] = None,
        keyring_backend: Optional[KeyringBackend] = None,
        file_backend: Optional[FileBackend] = None,
        priority: Optional[Iterable[str]] = None,
    ) -> None:
        self.env_backend = env_backend or EnvBackend()
        self.keyring_backend = keyring_backend or KeyringBackend()
        self.file_backend = file_backend or FileBackend()
        # default lookup priority: env -> keyring -> file
        self.priority = list(priority or ("env", "keyring", "file"))

    def _backends(self) -> Dict[str, SecretsBackend]:
        return {
            "env": self.env_backend,
            "keyring": self.keyring_backend,
            "file": self.file_backend,
        }

    def get(self, name: str) -> Optional[SecretRecord]:
        for src in self.priority:
            backend = self._backends()[src]
            val = backend.get(name)
            if val:
                return SecretRecord(name=name, value=val, source=src)
        return None

    def set(self, name: str, value: str, targets: Iterable[str] = ("keyring",)) -> Dict[str, bool]:
        results: Dict[str, bool] = {}
        for t in targets:
            try:
                self._backends()[t].set(name, value)
                results[t] = True
            except Exception:
                results[t] = False
        return results

    def delete(self, name: str, targets: Iterable[str] = ("keyring", "env", "file")) -> Dict[str, bool]:
        results: Dict[str, bool] = {}
        for t in targets:
            try:
                self._backends()[t].delete(name)
                results[t] = True
            except Exception:
                results[t] = False
        return results

    def list(self) -> Dict[str, Tuple[str, str]]:
        # returns name -> (redacted_value, source)
        collected: Dict[str, Tuple[str, str]] = {}
        # env precedence first
        for src in self.priority:
            backend = self._backends()[src]
            for k, v in backend.list().items():
                if k in collected:
                    continue
                redacted = self._redact(v)
                collected[k] = (redacted, src)
        return collected

    def sync_env_file(self, keys: Iterable[str], env_path: Path) -> Dict[str, bool]:
        envb = EnvBackend(env_path)
        results: Dict[str, bool] = {}
        for k in keys:
            rec = self.get(k)
            if rec:
                try:
                    envb.set(k, rec.value)
                    results[k] = True
                except Exception:
                    results[k] = False
            else:
                results[k] = False
        return results

    @staticmethod
    def _redact(value: str) -> str:
        if not value:
            return ""
        if len(value) <= 8:
            return "*" * len(value)
        return value[:4] + "*" * (len(value) - 8) + value[-4:]


# Common key names used across the monorepo
DEFAULT_KEY_NAMES = [
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "GEMINI_API_KEY_SECONDARY",
    "DEEPSEEK_API_KEY",
    "POLYGON_API_KEY",
    "PINECONE_API_KEY",
    "LITELLM_PROXY_URL",
]


def load_api_key(name: str, env_path: Optional[Path] = None) -> Optional[str]:
    """Helper to load an API key by name using default manager."""
    mgr = SecretsManager(env_backend=EnvBackend(env_path))
    rec = mgr.get(name)
    return rec.value if rec else None

