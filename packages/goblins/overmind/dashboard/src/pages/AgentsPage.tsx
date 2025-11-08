import React from "react";
import readme from "../../../README.md?raw";

export function AgentsPage() {
	return (
		<div>
			<h2 style={{ fontWeight: 600, marginBottom: 8 }}>Agents</h2>
			<p style={{ marginBottom: 12 }}>
				Placeholder page. This section will summarize agents across guilds.
				Below is the Overmind README for context.
			</p>
			<pre
				style={{
					whiteSpace: "pre-wrap",
					background: "#fafafa",
					padding: 12,
					border: "1px solid #eee",
				}}
			>
				{readme}
			</pre>
		</div>
	);
}
