"""PostgreSQL Testcontainer for Python integration tests."""

from typing import Optional
from testcontainers.postgres import PostgresContainer as TCPostgresContainer
import asyncpg


class PostgresContainer:
    """PostgreSQL container for integration testing with asyncpg."""

    def __init__(
        self,
        image: str = "postgres:16-alpine",
        username: str = "test_user",
        password: str = "test_password",
        database: str = "test_db",
        port: int = 5432
    ):
        self.image = image
        self.username = username
        self.password = password
        self.database = database
        self.port = port
        self._container: Optional[TCPostgresContainer] = None
        self._connection: Optional[asyncpg.Connection] = None

    async def start(self) -> "PostgresContainer":
        """Start the PostgreSQL container."""
        self._container = TCPostgresContainer(
            image=self.image,
            username=self.username,
            password=self.password,
            dbname=self.database,
            port=self.port
        )
        self._container.start()
        return self

    async def stop(self) -> None:
        """Stop the PostgreSQL container."""
        if self._connection:
            await self._connection.close()
            self._connection = None

        if self._container:
            self._container.stop()
            self._container = None

    async def get_connection(self) -> asyncpg.Connection:
        """Get an asyncpg connection to the database."""
        if not self._connection:
            if not self._container:
                raise RuntimeError("Container not started. Call start() first.")

            self._connection = await asyncpg.connect(
                host=self.get_host(),
                port=self.get_port(),
                user=self.username,
                password=self.password,
                database=self.database
            )

        return self._connection

    def get_connection_string(self) -> str:
        """Get the PostgreSQL connection string."""
        return f"postgresql://{self.username}:{self.password}@{self.get_host()}:{self.get_port()}/{self.database}"

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

    async def __aenter__(self) -> "PostgresContainer":
        """Async context manager entry."""
        return await self.start()

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.stop()
