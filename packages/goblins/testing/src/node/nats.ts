// Short-term: avoid importing types from the `nats` package to prevent
// resolution errors during triage. Use permissive `any` aliases here and
// delegate runtime connection creation to the Overmind nats adapter.
type ConnectionOptions = any;
type NatsConnection = any;
type StreamConfig = any;
import {
	GenericContainer,
	type StartedTestContainer,
	Wait,
} from "testcontainers";

export interface NatsOptions {
	/** Docker image to use (default: nats:2.10-alpine) */
	image?: string;
	/** Enable JetStream (default: true) */
	enableJetStream?: boolean;
	/** Username for NATS authentication */
	username?: string;
	/** Password for NATS authentication */
	password?: string;
	/** Port to expose (0 = random) */
	port?: number;
}

export class NatsTestcontainer {
	private container: StartedTestContainer;
	private options: Required<
		Omit<NatsOptions, "username" | "password" | "port">
	> & {
		username?: string;
		password?: string;
		port?: number;
	};
	private _connection?: NatsConnection;

	private constructor(
		container: StartedTestContainer,
		options: Required<Omit<NatsOptions, "username" | "password" | "port">> & {
			username?: string;
			password?: string;
			port?: number;
		},
	) {
		this.container = container;
		this.options = options;
	}

	static async start(options: NatsOptions = {}): Promise<NatsTestcontainer> {
		const opts = {
			image: options.image ?? "nats:2.10-alpine",
			enableJetStream: options.enableJetStream ?? true,
			username: options.username,
			password: options.password,
			port: options.port,
		};

		const command: string[] = ["--name", "nats-testcontainer"];

		// Enable JetStream
		if (opts.enableJetStream) {
			command.push("-js");
		}

		// Add authentication if provided
		if (opts.username && opts.password) {
			command.push("--user", opts.username);
			command.push("--pass", opts.password);
		}

		const containerBuilder = new GenericContainer(opts.image)
			.withCommand(command)
			.withExposedPorts(opts.port ?? 4222)
			.withWaitStrategy(Wait.forLogMessage(/Server is ready/));

		const container = await containerBuilder.start();

		return new NatsTestcontainer(container, opts);
	}

	async stop(): Promise<void> {
		if (this._connection) {
			await this._connection.close();
			this._connection = undefined;
		}
		await this.container.stop();
	}

	async getClient(): Promise<NatsConnection> {
		if (!this._connection) {
			// Delegate to the overmind nats adapter which normalizes module shapes
			// across different installs and bundlers. Use a dynamic import to keep
			// the test helper lightweight when the adapter isn't needed.
			// Use require at runtime to avoid TypeScript trying to include files
			// from another package in the testing project's file list.
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const {
				connectNats,
			} = require("../../../overmind/src/clients/nats-adapter.js");

			const connectionOptions: ConnectionOptions = {
				servers: this.getConnectionString(),
			};

			if (this.options.username && this.options.password) {
				connectionOptions.user = this.options.username;
				connectionOptions.pass = this.options.password;
			}

			this._connection = await connectNats(connectionOptions);
		}
		return this._connection;
	}

	async createStream(config: StreamConfig): Promise<void> {
		const nc = await this.getClient();
		const jsm = await nc.jetstreamManager();
		await jsm.streams.add(config);
	}

	getConnectionString(): string {
		return `nats://${this.getHost()}:${this.getPort()}`;
	}

	getHost(): string {
		return this.container.getHost();
	}

	getPort(): number {
		return this.container.getMappedPort(this.options.port ?? 4222);
	}
}
