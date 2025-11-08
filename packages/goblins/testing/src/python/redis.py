"""Redis Testcontainer for Python integration tests."""

from typing import Optional
from testcontainers.redis import RedisContainer as TCRedisContainer
import redis.asyncio as redis


class RedisContainer:
    """Redis container for integration testing with redis-py."""

    def __init__(
        self,
        image: str = "redis:7-alpine",
        password: Optional[str] = None,
        port: int = 6379
    ):
        self.image = image
        self.password = password
        self.port = port
        self._container: Optional[TCRedisContainer] = None
        self._client: Optional[redis.Redis] = None

    async def start(self) -> "RedisContainer":
        """Start the Redis container."""
        self._container = TCRedisContainer(image=self.image, port=self.port)

        if self.password:
            self._container = self._container.with_command(
                f"redis-server --requirepass {self.password}"
            )

        self._container.start()
        return self

    async def stop(self) -> None:
        """Stop the Redis container."""
        if self._client:
            await self._client.close()
            self._client = None

        if self._container:
            self._container.stop()
            self._container = None

    async def get_client(self) -> redis.Redis:
        """Get a redis-py async client."""
        if not self._client:
            if not self._container:
                raise RuntimeError("Container not started. Call start() first.")

            client_kwargs = {
                "host": self.get_host(),
                "port": self.get_port(),
                "decode_responses": True
            }

            if self.password:
                client_kwargs["password"] = self.password

            self._client = redis.Redis(**client_kwargs)

        return self._client

    def get_connection_string(self) -> str:
        """Get the Redis connection string."""
        auth = f":{self.password}@" if self.password else ""
        return f"redis://{auth}{self.get_host()}:{self.get_port()}"

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

    async def __aenter__(self) -> "RedisContainer":
        """Async context manager entry."""
        return await self.start()

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.stop()
