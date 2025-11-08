import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresTestcontainer } from "../src/node/postgres.js";

describe("PostgresTestcontainer", () => {
	let postgres: PostgresTestcontainer;

	beforeAll(async () => {
		postgres = await PostgresTestcontainer.start({
			database: "test_db",
			username: "test_user",
			password: "test_password",
		});
	}, 30000);

	afterAll(async () => {
		await postgres.stop();
	});

	it("should start and provide connection details", () => {
		expect(postgres.getHost()).toBeDefined();
		expect(postgres.getPort()).toBeGreaterThan(0);
		expect(postgres.getConnectionString()).toContain("postgresql://");
	});

	it("should allow client connection and queries", async () => {
		const client = postgres.getClient();

		// Create test table
		await client.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

		// Insert test data
		await client.query("INSERT INTO test_table (name) VALUES ($1)", [
			"Test Record",
		]);

		// Query data
		const result = await client.query("SELECT * FROM test_table");

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].name).toBe("Test Record");
		expect(result.rows[0].id).toBe(1);
	});

	it("should support transactions", async () => {
		const client = postgres.getClient();

		try {
			await client.query("BEGIN");

			await client.query("INSERT INTO test_table (name) VALUES ($1)", [
				"Transaction Test",
			]);

			const result = await client.query("SELECT COUNT(*) FROM test_table");
			expect(Number.parseInt(result.rows[0].count)).toBeGreaterThan(0);

			await client.query("ROLLBACK");

			// Verify rollback
			const afterRollback = await client.query(
				"SELECT COUNT(*) FROM test_table WHERE name = 'Transaction Test'",
			);
			expect(Number.parseInt(afterRollback.rows[0].count)).toBe(0);
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		}
	});
});
