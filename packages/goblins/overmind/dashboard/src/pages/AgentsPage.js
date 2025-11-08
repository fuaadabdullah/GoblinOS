import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import readme from "../../../README.md?raw";
export function AgentsPage() {
	return _jsxs("div", {
		children: [
			_jsx("h2", {
				style: { fontWeight: 600, marginBottom: 8 },
				children: "Agents",
			}),
			_jsx("p", {
				style: { marginBottom: 12 },
				children:
					"Placeholder page. This section will summarize agents across guilds. Below is the Overmind README for context.",
			}),
			_jsx("pre", {
				style: {
					whiteSpace: "pre-wrap",
					background: "#fafafa",
					padding: 12,
					border: "1px solid #eee",
				},
				children: readme,
			}),
		],
	});
}
