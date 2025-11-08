import {
	BaseLiteBrain,
	type LiteBrainConfig,
	mergeLiteBrainConfig,
} from "./base.js";
import { getMemberLiteBrainConfig } from "./registry.js";

export class HuntressLiteBrain extends BaseLiteBrain {
	constructor(
		member: "magnolia-nightbloom" | "mags-charietto" = "magnolia-nightbloom",
		overrides: Partial<LiteBrainConfig> = {},
	) {
		const defaults = getMemberLiteBrainConfig(member);
		const config = mergeLiteBrainConfig(defaults, overrides);

		super(config);
	}
}
