import {
	BaseLiteBrain,
	type LiteBrainConfig,
	mergeLiteBrainConfig,
} from "./base.js";
import { getMemberLiteBrainConfig } from "./registry.js";

export class KeepersLiteBrain extends BaseLiteBrain {
	constructor(overrides: Partial<LiteBrainConfig> = {}) {
		const defaults = getMemberLiteBrainConfig("sentenial-ledgerwarden");
		const config = mergeLiteBrainConfig(defaults, overrides);

		super(config);
	}
}
