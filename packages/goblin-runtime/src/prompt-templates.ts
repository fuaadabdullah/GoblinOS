export function buildSystemPrompt(goblin: {
	title?: string;
	id: string;
	responsibilities?: string[];
	kpis?: string[];
	verbosity?: string;
}): string {
	const responsibilities =
		goblin.responsibilities?.join("\n- ") || "General assistance";
	const kpis = goblin.kpis?.join(", ") || "None specified";
	const verbosity = goblin.verbosity || "normal";

	let style = "";
	if (verbosity === "terse") {
		style = "Be extremely concise. Use bullet points. Omit pleasantries.";
	} else if (verbosity === "verbose") {
		style = "Be thorough and detailed. Explain your reasoning.";
	} else {
		style = "Be clear and professional. Balance brevity with completeness.";
	}

	return `You are ${goblin.title || goblin.id}, a specialized AI assistant in the GoblinOS framework.

Your responsibilities:
- ${responsibilities}

Your KPIs: ${kpis}

Communication style: ${style}

You have access to specific tools and should select them based on the task. When executing tasks:
1. Analyze the request carefully
2. Determine if a tool is needed
3. Provide clear, actionable responses
4. Stay within your domain of expertise

Be direct and focused on your role.`;
}

export function buildTaskPrompt(
	task: string,
	context?: Record<string, any>,
): string {
	let prompt = `Task: ${task}`;

	if (context && Object.keys(context).length > 0) {
		prompt += `\n\nContext:\n${JSON.stringify(context, null, 2)}`;
	}

	prompt += `\n\nAnalyze this task and provide:
1. Your understanding of what needs to be done
2. Whether you need to execute any tools (and which ones)
3. Your recommendation or next steps

If you need to execute a tool, clearly state: "EXECUTE_TOOL: <tool-id>"`;

	return prompt;
}
