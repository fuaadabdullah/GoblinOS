import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RedisTestcontainer } from "../src/node/redis.js";

describe("RedisTestcontainer", () => {
	let redis: RedisTestcontainer;

	beforeAll(async () => {
		redis = await RedisTestcontainer.start();
	}, 30000);

	afterAll(async () => {
		await redis.stop();
	});

	it("should start and provide connection details", () => {
		expect(redis.getHost()).toBeDefined();
		expect(redis.getPort()).toBeGreaterThan(0);
		expect(redis.getConnectionString()).toContain("redis://");
	});

	it("should allow basic set/get operations", async () => {
		const client = await redis.getClient();

		await client.set("test:key", "test value");
		const value = await client.get("test:key");

		expect(value).toBe("test value");
	});

	it("should support expiration", async () => {
		const client = await redis.getClient();

		await client.set("test:expire", "expires soon", { EX: 1 });

		const immediate = await client.get("test:expire");
		expect(immediate).toBe("expires soon");

		// Wait for expiration
		await new Promise((resolve) => setTimeout(resolve, 1100));

		const afterExpire = await client.get("test:expire");
		expect(afterExpire).toBeNull();
	});

	it("should support hash operations", async () => {
		const client = await redis.getClient();

		await client.hSet("test:hash", {
			field1: "value1",
			field2: "value2",
		});

		const value = await client.hGet("test:hash", "field1");
		expect(value).toBe("value1");

		const all = await client.hGetAll("test:hash");
		expect(all).toEqual({
			field1: "value1",
			field2: "value2",
		});
	});

	it("should support list operations", async () => {
		const client = await redis.getClient();

		await client.rPush("test:list", ["item1", "item2", "item3"]);

		const length = await client.lLen("test:list");
		expect(length).toBe(3);

		const items = await client.lRange("test:list", 0, -1);
		expect(items).toEqual(["item1", "item2", "item3"]);
	});
});
