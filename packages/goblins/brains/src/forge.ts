import {
	BaseLiteBrain,
	type LiteBrainConfig,
	mergeLiteBrainConfig,
} from "./base.js";
import { getMemberLiteBrainConfig } from "./registry.js";

export class ForgeLiteBrain extends BaseLiteBrain {
	constructor(overrides: Partial<LiteBrainConfig> = {}) {
		const defaults = getMemberLiteBrainConfig("dregg-embercode");
		const config = mergeLiteBrainConfig(defaults, overrides);

		super(config);
	}
}
