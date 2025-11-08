import {
	BaseLiteBrain,
	type LiteBrainConfig,
	mergeLiteBrainConfig,
} from "./base.js";
import { getMemberLiteBrainConfig } from "./registry.js";

export class MagesLiteBrain extends BaseLiteBrain {
	constructor(
		member: "hex-oracle" | "grim-rune" | "launcey-gauge" = "hex-oracle",
		overrides: Partial<LiteBrainConfig> = {},
	) {
		const defaults = getMemberLiteBrainConfig(member);
		const config = mergeLiteBrainConfig(defaults, overrides);

		super(config);
	}
}
