import React from "react";
import readme from "../../../README.md?raw";

export function MemoryPage() {
	return (
		<div>
			<h2 style={{ fontWeight: 600, marginBottom: 8 }}>Memory</h2>
			<p style={{ marginBottom: 12 }}>
				Placeholder page. This section will surface memory explorers and vector
				search. README content included below.
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
