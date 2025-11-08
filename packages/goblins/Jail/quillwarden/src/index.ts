type Goblin = {
	name: string;
	run(args: Record<string, unknown>): Promise<number>;
	health?: () => Promise<string>;
};

export default function make(): Goblin {
	return {
		name: "quillwarden",
		async run() {
			console.log("[quillwarden] todo: enforce headers + linguist-generated");
			return 0;
		},
	};
}
