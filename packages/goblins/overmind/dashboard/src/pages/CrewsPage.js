import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Import README as raw to show placeholder content
import readme from "../../../README.md?raw";
export function CrewsPage() {
	return _jsxs("div", {
		children: [
			_jsx("h2", {
				style: { fontWeight: 600, marginBottom: 8 },
				children: "Crews",
			}),
			_jsx("p", {
				style: { marginBottom: 12 },
				children:
					"Placeholder page. This section will list active crews and routes to crew details. Below is content from the Overmind README for context.",
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
