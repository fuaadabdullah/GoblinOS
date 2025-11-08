import {
	BaseLiteBrain,
	type LiteBrainConfig,
	mergeLiteBrainConfig,
} from "./base.js";
import { getMemberLiteBrainConfig } from "./registry.js";

export class CraftersLiteBrain extends BaseLiteBrain {
	constructor(
		member: "vanta-lumin" | "volt-furnace" = "vanta-lumin",
		overrides: Partial<LiteBrainConfig> = {},
	) {
		const defaults = getMemberLiteBrainConfig(member);
		const config = mergeLiteBrainConfig(defaults, overrides);

		super(config);
	}
}
