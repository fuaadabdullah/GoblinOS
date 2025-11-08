"""NATS JetStream Testcontainer for Python integration tests."""

from typing import Optional, Dict, Any
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs
import nats
from nats.js.api import StreamConfig


class NatsContainer:
    """NATS JetStream container for integration testing with nats-py."""

    def __init__(
        self,
        image: str = "nats:2.10-alpine",
        enable_jetstream: bool = True,
        username: Optional[str] = None,
        password: Optional[str] = None,
        port: int = 4222
    ):
        self.image = image
        self.enable_jetstream = enable_jetstream
        self.username = username
        self.password = password
        self.port = port
        self._container: Optional[DockerContainer] = None
        self._connection: Optional[nats.NATS] = None

    async def start(self) -> "NatsContainer":
        """Start the NATS container."""
        command = ["--name", "nats-testcontainer"]

        if self.enable_jetstream:
            command.append("-js")

        if self.username and self.password:
            command.extend(["--user", self.username])
            command.extend(["--pass", self.password])

        self._container = DockerContainer(image=self.image)
        self._container.with_command(" ".join(command))
        self._container.with_exposed_ports(self.port)

        self._container.start()

        # Wait for NATS to be ready
        wait_for_logs(self._container, "Server is ready", timeout=30)

        return self

    async def stop(self) -> None:
        """Stop the NATS container."""
        if self._connection:
            await self._connection.close()
            self._connection = None

        if self._container:
            self._container.stop()
            self._container = None

    async def get_client(self) -> nats.NATS:
        """Get a NATS client connection."""
        if not self._connection:
            if not self._container:
                raise RuntimeError("Container not started. Call start() first.")

            self._connection = await nats.connect(
                servers=[self.get_connection_string()],
                user=self.username,
                password=self.password
            )

        return self._connection

    async def create_stream(self, config: StreamConfig) -> None:
        """Create a JetStream stream."""
        nc = await self.get_client()
        js = nc.jetstream()
        await js.add_stream(config)

    def get_connection_string(self) -> str:
        """Get the NATS connection string."""
        return f"nats://{self.get_host()}:{self.get_port()}"

    def get_host(self) -> str:
        """Get the container host."""
        if not self._container:
            raise RuntimeError("Container not started")
        return self._container.get_container_host_ip()

    def get_port(self) -> int:
        """Get the mapped port."""
        if not self._container:
            raise RuntimeError("Container not started")
        return int(self._container.get_exposed_port(self.port))

    async def __aenter__(self) -> "NatsContainer":
        """Async context manager entry."""
        return await self.start()

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.stop()
