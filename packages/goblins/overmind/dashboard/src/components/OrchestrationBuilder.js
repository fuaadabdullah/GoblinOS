export { default } from "./OrchestrationBuilder";
export * from "./OrchestrationBuilder";

// Thin wrapper re-export for OrchestrationBuilder
export { default } from "./OrchestrationBuilder";
export * from "./OrchestrationBuilder";
/**
 * OrchestrationBuilder - Visual drag-and-drop workflow editor
 *
 * Features:
 * - Add/remove steps visually
 * - Configure step type (THEN/AND/IF)
 * - Assign goblins to steps
 * - Preview generated orchestration syntax
 * - Export to TaskExecutor
 */
import { useState } from "react";
export function OrchestrationBuilder({ goblins, onGenerate, onClose, }) {
    const [steps, setSteps] = useState([
        {
            id: crypto.randomUUID(),
            goblinId: goblins[0]?.id || "",
            task: "",
            type: "sequential",
        },
    ]);
    const [syntax, setSyntax] = useState("");
    // Add a new step
    const addStep = (type) => {
        const newStep = {
            id: crypto.randomUUID(),
            goblinId: goblins[0]?.id || "",
            task: "",
            type,
        };
        setSteps([...steps, newStep]);
    };
    // Remove a step
    const removeStep = (id) => {
        if (steps.length === 1)
            return; // Keep at least one step
        setSteps(steps.filter((s) => s.id !== id));
    };
    // Update step properties
    const updateStep = (id, updates) => {
        setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    };
    // Move step up
    const moveStepUp = (index) => {
        if (index === 0)
            return;
        const newSteps = [...steps];
        [newSteps[index - 1], newSteps[index]] = [
            newSteps[index],
            newSteps[index - 1],
        ];
        setSteps(newSteps);
    };
    // Move step down
    const moveStepDown = (index) => {
        if (index === steps.length - 1)
            return;
        const newSteps = [...steps];
        [newSteps[index], newSteps[index + 1]] = [
            newSteps[index + 1],
            newSteps[index],
        ];
        setSteps(newSteps);
    };
    // Generate orchestration syntax
    const generateSyntax = () => {
        if (steps.length === 0) {
            setSyntax("");
            return;
        }
        const parts = [];
        let parallelGroup = [];
        steps.forEach((step, index) => {
            const goblin = goblins.find((g) => g.id === step.goblinId);
            const goblinPrefix = goblin ? `${goblin.id}: ` : "";
            const taskText = step.task || "[task]";
            if (step.type === "parallel") {
                // Collect parallel steps
                parallelGroup.push(`${goblinPrefix}${taskText}`);
                // If next step is not parallel or this is last step, flush parallel group
                if (index === steps.length - 1 ||
                    steps[index + 1].type !== "parallel") {
                    parts.push(parallelGroup.join(" AND "));
                    parallelGroup = [];
                }
            }
            else if (step.type === "conditional") {
                // Conditional step
                const conditionMap = {
                    success: "IF_SUCCESS",
                    failure: "IF_FAILURE",
                    contains: `IF_CONTAINS("${step.conditionValue || ""}")`,
                };
                const condition = conditionMap[step.condition || "success"];
                parts.push(`${goblinPrefix}${taskText} ${condition}`);
            }
            else {
                // Sequential step
                parts.push(`${goblinPrefix}${taskText}`);
            }
        });
        const generatedSyntax = parts.join(" THEN ");
        setSyntax(generatedSyntax);
    };
    // Handle generate button click
    const handleGenerate = () => {
        generateSyntax();
    };
    // Handle use syntax button
    const handleUseSyntax = () => {
        if (syntax) {
            onGenerate(syntax);
            onClose();
        }
    };
    // Get goblin name
    const getGoblinName = (goblinId) => {
        return goblins.find((g) => g.id === goblinId)?.title || goblinId;
    };
    return (_jsx("div", { className: "orchestration-builder-overlay", onClick: onClose, children: _jsxs("div", { className: "orchestration-builder-modal", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "builder-header", children: [_jsx("h2", { children: "Orchestration Builder" }), _jsx("button", { className: "close-btn", onClick: onClose, children: "\u00D7" })] }), _jsxs("div", { className: "builder-content", children: [_jsxs("div", { className: "steps-section", children: [_jsxs("div", { className: "section-header", children: [_jsx("h3", { children: "Workflow Steps" }), _jsxs("div", { className: "add-step-buttons", children: [_jsx("button", { className: "add-step-btn sequential", onClick: () => addStep("sequential"), title: "Add sequential step (THEN)", children: "+ Sequential" }), _jsx("button", { className: "add-step-btn parallel", onClick: () => addStep("parallel"), title: "Add parallel step (AND)", children: "+ Parallel" }), _jsx("button", { className: "add-step-btn conditional", onClick: () => addStep("conditional"), title: "Add conditional step (IF)", children: "+ Conditional" })] })] }), _jsx("div", { className: "steps-list", children: steps.map((step, index) => (_jsxs("div", { className: `step-card ${step.type}`, children: [_jsxs("div", { className: "step-header", children: [_jsxs("span", { className: "step-number", children: ["#", index + 1] }), _jsx("span", { className: "step-type-badge", children: step.type }), _jsxs("div", { className: "step-controls", children: [_jsx("button", { className: "icon-btn", onClick: () => moveStepUp(index), disabled: index === 0, title: "Move up", children: "\u2191" }), _jsx("button", { className: "icon-btn", onClick: () => moveStepDown(index), disabled: index === steps.length - 1, title: "Move down", children: "\u2193" }), _jsx("button", { className: "icon-btn delete", onClick: () => removeStep(step.id), disabled: steps.length === 1, title: "Delete step", children: "\uD83D\uDDD1" })] })] }), _jsxs("div", { className: "step-body", children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Goblin:" }), _jsx("select", { value: step.goblinId, onChange: (e) => updateStep(step.id, { goblinId: e.target.value }), children: goblins.map((g) => (_jsx("option", { value: g.id, children: g.title }, g.id))) })] }), _jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Task:" }), _jsx("input", { type: "text", value: step.task, onChange: (e) => updateStep(step.id, { task: e.target.value }), placeholder: "Enter task description..." })] }), step.type === "conditional" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Condition:" }), _jsxs("select", { value: step.condition || "success", onChange: (e) => updateStep(step.id, {
                                                                            condition: e.target.value,
                                                                        }), children: [_jsx("option", { value: "success", children: "If Success" }), _jsx("option", { value: "failure", children: "If Failure" }), _jsx("option", { value: "contains", children: "If Contains" })] })] }), step.condition === "contains" && (_jsxs("div", { className: "form-group", children: [_jsx("label", { children: "Contains Value:" }), _jsx("input", { type: "text", value: step.conditionValue || "", onChange: (e) => updateStep(step.id, {
                                                                            conditionValue: e.target.value,
                                                                        }), placeholder: "Text to check for..." })] }))] })), _jsxs("div", { className: "step-info", children: [step.type === "sequential" && (_jsx("span", { children: "Will execute after previous step completes" })), step.type === "parallel" && (_jsx("span", { children: "Will execute in parallel with adjacent parallel steps" })), step.type === "conditional" && (_jsx("span", { children: "Will execute only if condition is met" }))] })] })] }, step.id))) })] }), _jsxs("div", { className: "preview-section", children: [_jsxs("div", { className: "section-header", children: [_jsx("h3", { children: "Generated Syntax" }), _jsx("button", { className: "generate-btn", onClick: handleGenerate, children: "Generate" })] }), syntax ? (_jsx("div", { className: "syntax-preview", children: _jsx("code", { children: syntax }) })) : (_jsx("div", { className: "empty-preview", children: "Click \"Generate\" to preview orchestration syntax" })), syntax && (_jsxs("div", { className: "flow-preview", children: [_jsx("h4", { children: "Execution Flow" }), _jsx("div", { className: "flow-diagram", children: steps.map((step, index) => (_jsxs("div", { className: "flow-item", children: [_jsxs("div", { className: "flow-node", children: [_jsx("div", { className: "flow-node-header", children: _jsx("span", { className: "flow-goblin", children: getGoblinName(step.goblinId) }) }), _jsx("div", { className: "flow-node-body", children: step.task || "[task]" }), step.type === "conditional" && (_jsxs("div", { className: "flow-node-condition", children: [step.condition === "success" && "✓ If Success", step.condition === "failure" && "✗ If Failure", step.condition === "contains" &&
                                                                        `⊃ Contains "${step.conditionValue}"`] }))] }), index < steps.length - 1 && (_jsx("div", { className: `flow-connector ${steps[index + 1].type === "parallel"
                                                            ? "parallel"
                                                            : "sequential"}`, children: steps[index + 1].type === "parallel" ? "⋮" : "↓" }))] }, step.id))) })] }))] })] }), _jsxs("div", { className: "builder-footer", children: [_jsx("button", { className: "cancel-btn", onClick: onClose, children: "Cancel" }), _jsx("button", { className: "use-syntax-btn", onClick: handleUseSyntax, disabled: !syntax, children: "Use This Workflow" })] })] }) }));
}
