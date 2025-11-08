import React from "react";
// Import README as raw to show placeholder content
import readme from "../../../README.md?raw";

export function CrewsPage() {
	return (
		<div>
			<h2 style={{ fontWeight: 600, marginBottom: 8 }}>Crews</h2>
			<p style={{ marginBottom: 12 }}>
				Placeholder page. This section will list active crews and routes to crew
				details. Below is content from the Overmind README for context.
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
