// Import README as raw to show placeholder content
import readme from "../../../README.md?raw";

export function CrewsPage() {
	return (
		<div>
			<h2 className="heading-strong">Crews</h2>
			<p className="page-description">
				Placeholder page. This section will list active crews and routes to crew
				details. Below is content from the Overmind README for context.
			</p>
			<pre className="code-block">
				{readme}
			</pre>
		</div>
	);
}
