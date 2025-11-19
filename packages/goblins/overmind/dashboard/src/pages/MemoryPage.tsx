import readme from "../../../README.md?raw";

export function MemoryPage() {
	return (
		<div>
			<h2 className="heading-strong">Memory</h2>
			<p className="page-description">
				Placeholder page. This section will surface memory explorers and vector
				search. README content included below.
			</p>
			<pre className="code-block">
				{readme}
			</pre>
		</div>
	);
}
