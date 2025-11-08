// Avoid importing types from `redis` during triage; use a permissive alias.
type RedisClientType = any;
import {
	GenericContainer,
	type StartedTestContainer,
	Wait,
} from "testcontainers";

export interface RedisOptions {
	/** Docker image to use (default: redis:7-alpine) */
	image?: string;
	/** Password for Redis */
	password?: string;
	/** Port to expose (0 = random) */
	port?: number;
}

export class RedisTestcontainer {
	private container: StartedTestContainer;
	private options: Required<Omit<RedisOptions, "password" | "port">> & {
		password?: string;
		port?: number;
	};
	private _client?: RedisClientType;

	private constructor(
		container: StartedTestContainer,
		options: Required<Omit<RedisOptions, "password" | "port">> & {
			password?: string;
			port?: number;
		},
	) {
		this.container = container;
		this.options = options;
	}

	static async start(options: RedisOptions = {}): Promise<RedisTestcontainer> {
		const opts = {
			image: options.image ?? "redis:7-alpine",
			password: options.password,
			port: options.port,
		};

		const env: Record<string, string> = {};
		let command: string[] | undefined;

		if (opts.password) {
			command = ["redis-server", "--requirepass", opts.password];
		}

		const containerBuilder = new GenericContainer(opts.image)
			.withEnvironment(env)
			.withExposedPorts(opts.port ?? 6379)
			.withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/));

		if (command) {
			containerBuilder.withCommand(command);
		}

		const container = await containerBuilder.start();

		return new RedisTestcontainer(container, opts);
	}

	async stop(): Promise<void> {
		if (this._client) {
			await this._client.quit();
			this._client = undefined;
		}
		await this.container.stop();
	}

	async getClient(): Promise<RedisClientType> {
		if (!this._client) {
			// Lazy import to avoid dependency when not used
			const redis = await import("redis");
			const clientOptions: Record<string, unknown> = {
				socket: {
					host: this.getHost(),
					port: this.getPort(),
				},
			};

			if (this.options.password) {
				clientOptions.password = this.options.password;
			}

			this._client = redis.createClient(clientOptions) as RedisClientType;
			await this._client.connect();
		}
		return this._client;
	}

	getConnectionString(): string {
		const auth = this.options.password ? `:${this.options.password}@` : "";
		return `redis://${auth}${this.getHost()}:${this.getPort()}`;
	}

	getHost(): string {
		return this.container.getHost();
	}

	getPort(): number {
		return this.container.getMappedPort(this.options.port ?? 6379);
	}
}
