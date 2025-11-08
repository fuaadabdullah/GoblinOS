import type { Client } from "pg";
import {
	GenericContainer,
	type StartedTestContainer,
	Wait,
} from "testcontainers";

export interface PostgresOptions {
	/** Docker image to use (default: postgres:16-alpine) */
	image?: string;
	/** Database name (default: test_db) */
	database?: string;
	/** Username (default: test_user) */
	username?: string;
	/** Password (default: test_password) */
	password?: string;
	/** SQL files to run on startup */
	initScripts?: string[];
	/** Port to expose (0 = random) */
	port?: number;
}

export class PostgresTestcontainer {
	private container: StartedTestContainer;
	private options: Required<Omit<PostgresOptions, "initScripts" | "port">> & {
		initScripts?: string[];
		port?: number;
	};
	private _client?: Client;

	private constructor(
		container: StartedTestContainer,
		options: Required<Omit<PostgresOptions, "initScripts" | "port">> & {
			initScripts?: string[];
			port?: number;
		},
	) {
		this.container = container;
		this.options = options;
	}

	static async start(
		options: PostgresOptions = {},
	): Promise<PostgresTestcontainer> {
		const opts = {
			image: options.image ?? "postgres:16-alpine",
			database: options.database ?? "test_db",
			username: options.username ?? "test_user",
			password: options.password ?? "test_password",
			initScripts: options.initScripts,
			port: options.port,
		};

		let containerBuilder = new GenericContainer(opts.image)
			.withEnvironment({
				POSTGRES_DB: opts.database,
				POSTGRES_USER: opts.username,
				POSTGRES_PASSWORD: opts.password,
			})
			.withExposedPorts(opts.port ?? 5432)
			.withWaitStrategy(
				Wait.forLogMessage(/database system is ready to accept connections/),
			);

		// Add init scripts if provided
		if (opts.initScripts && opts.initScripts.length > 0) {
			for (const script of opts.initScripts) {
				containerBuilder = containerBuilder.withCopyFilesToContainer([
					{ source: script, target: `/docker-entrypoint-initdb.d/${script}` },
				]);
			}
		}

		const container = await containerBuilder.start();

		return new PostgresTestcontainer(container, opts);
	}

	async stop(): Promise<void> {
		if (this._client) {
			await this._client.end();
			this._client = undefined;
		}
		await this.container.stop();
	}

	getClient(): Client {
		if (!this._client) {
			// Lazy import to avoid dependency when not used
			const pg = require("pg");
			this._client = new pg.Client({
				host: this.getHost(),
				port: this.getPort(),
				database: this.options.database,
				user: this.options.username,
				password: this.options.password,
			});
			this._client.connect();
		}
		return this._client;
	}

	getConnectionString(): string {
		return `postgresql://${this.options.username}:${this.options.password}@${this.getHost()}:${this.getPort()}/${this.options.database}`;
	}

	getHost(): string {
		return this.container.getHost();
	}

	getPort(): number {
		return this.container.getMappedPort(this.options.port ?? 5432);
	}
}
