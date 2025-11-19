import readme from "../../../README.md?raw";

export function AgentsPage() {
	return (
		<div>
			<h2 className="heading-strong">Agents</h2>
			<p className="page-description">
				Placeholder page. This section will summarize agents across guilds.
				Below is the Overmind README for context.
			</p>
			<pre className="code-block">
				{readme}
			</pre>
		</div>
	);
}
