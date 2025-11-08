// Orchestration parser - Ported from TypeScript
// Parses THEN/AND/IF_SUCCESS syntax for multi-step workflows

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationStep {
    pub id: String,
    pub goblin_id: String,
    pub task: String,
    pub dependencies: Vec<String>, // IDs of steps that must complete first
    pub condition: Option<StepCondition>,
    pub status: StepStatus,
    pub result: Option<StepResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepCondition {
    pub step_id: String, // Step whose result to check
    pub operator: ConditionOperator,
    pub value: Option<String>, // For IF_CONTAINS checks
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConditionOperator {
    IfSuccess,
    IfFailure,
    IfContains,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub output: String,
    pub error: Option<String>,
    pub duration: u64,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationPlan {
    pub id: String,
    pub description: String,
    pub steps: Vec<OrchestrationStep>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub status: PlanStatus,
    pub text: Option<String>, // Original text for reference
    pub metadata: PlanMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PlanStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanMetadata {
    pub total_steps: usize,
    pub parallel_batches: usize,
    pub estimated_duration: Option<String>,
    pub original_text: Option<String>,
}

pub struct OrchestrationParser;

impl OrchestrationParser {
    /// Parse orchestration text into execution plan
    ///
    /// Syntax patterns:
    /// - "goblin1: task1 THEN goblin2: task2" - Sequential
    /// - "goblin1: task1 AND goblin2: task2" - Parallel
    /// - "goblin1: task1 IF success THEN goblin2: task2" - Conditional
    /// - Mixed: "build AND test THEN deploy IF passing"
    pub fn parse(text: &str, default_goblin_id: Option<&str>) -> Result<OrchestrationPlan, String> {
        // Validate input
        if text.trim().is_empty() {
            return Err("Orchestration text cannot be empty".to_string());
        }

        // Validate syntax - check for invalid patterns
        let trimmed = text.trim();
        if trimmed.starts_with("THEN ") || trimmed.starts_with("AND ") || trimmed.starts_with("IF ") {
            return Err("Invalid orchestration syntax".to_string());
        }

        if text.contains(" THEN THEN ") || text.contains(" AND AND ") {
            return Err("Invalid orchestration syntax".to_string());
        }

        let plan_id = format!("orch_{}_{}",
            chrono::Utc::now().timestamp_millis(),
            uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("unknown")
        );

        // Split by THEN for sequential phases
        let phases = Self::split_by_operator(text, "THEN");

        let mut steps: Vec<OrchestrationStep> = vec![];
        let mut previous_phase_step_ids: Vec<String> = vec![];

        for phase in phases {
            // Split phase by AND for parallel tasks
            let parallel_tasks = Self::split_by_operator(&phase, "AND");
            let mut current_phase_step_ids: Vec<String> = vec![];
            let mut last_goblin_id = default_goblin_id.map(|s| s.to_string());

            for task_text in parallel_tasks {
                let mut step = Self::parse_task(&task_text, last_goblin_id.as_deref())?;

                // Update last_goblin_id if this task had an explicit goblin ID
                if task_text.contains(':') && task_text.find(':').unwrap_or(100) < 30 {
                    let potential_goblin_id = task_text.split(':').next().unwrap_or("").trim();
                    if !potential_goblin_id.contains(' ') && potential_goblin_id.len() < 30 {
                        last_goblin_id = Some(potential_goblin_id.to_string());
                    }
                }

                // Add dependencies on previous phase
                step.dependencies = previous_phase_step_ids.clone();

                current_phase_step_ids.push(step.id.clone());
                steps.push(step);
            }

            previous_phase_step_ids = current_phase_step_ids;
        }

        // Calculate parallel batches
        let batches = Self::calculate_batches(&steps);

        // Calculate estimated duration (rough estimate: 2 seconds per step per batch)
        let estimated_duration_ms = batches * 2000;
        let estimated_duration = if estimated_duration_ms < 60000 {
            format!("{}s", (estimated_duration_ms / 1000).max(1))
        } else {
            format!("{}m", (estimated_duration_ms / 60000).max(1))
        };

        let total_steps = steps.len();

        Ok(OrchestrationPlan {
            id: plan_id,
            description: text.chars().take(100).collect(),
            steps,
            created_at: chrono::Utc::now(),
            status: PlanStatus::Pending,
            text: Some(text.to_string()),
            metadata: PlanMetadata {
                total_steps,
                parallel_batches: batches,
                estimated_duration: Some(estimated_duration),
                original_text: Some(text.to_string()),
            },
        })
    }

    /// Split text by operator while preserving order
    fn split_by_operator(text: &str, operator: &str) -> Vec<String> {
        let pattern = format!(" {} ", operator);
        text.split(&pattern)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    }

    /// Parse individual task: "goblinId: task description"
    /// If no goblinId specified, uses default
    fn parse_task(task_text: &str, default_goblin_id: Option<&str>) -> Result<OrchestrationStep, String> {
        let step_id = format!("step_{}_{}",
            chrono::Utc::now().timestamp_millis(),
            uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("unknown")
        );

        // Check for explicit conditional syntax
        let mut condition: Option<StepCondition> = None;
        let mut clean_task_text = task_text.to_string();

        // Match IF_SUCCESS or IF_FAILURE
        if let Some(caps) = regex::Regex::new(r"(.+?)\s+IF_(SUCCESS|FAILURE)\s*$")
            .ok()
            .and_then(|re| re.captures(task_text))
        {
            clean_task_text = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            let operator = caps.get(2).map(|m| m.as_str()).unwrap_or("SUCCESS");

            condition = Some(StepCondition {
                step_id: "previous".to_string(),
                operator: if operator == "SUCCESS" {
                    ConditionOperator::IfSuccess
                } else {
                    ConditionOperator::IfFailure
                },
                value: None,
            });
        }

        // Match IF_CONTAINS("value")
        if condition.is_none() {
            if let Some(caps) = regex::Regex::new(r#"(.+?)\s+IF_CONTAINS\s*\(\s*["']([^"']+)["']\s*\)\s*$"#)
                .ok()
                .and_then(|re| re.captures(task_text))
            {
                clean_task_text = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
                let value = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();

                condition = Some(StepCondition {
                    step_id: "previous".to_string(),
                    operator: ConditionOperator::IfContains,
                    value: Some(value),
                });
            }
        }

        // Also check for natural language conditional syntax
        if condition.is_none() {
            if let Some(caps) = regex::Regex::new(r"(.+?)\s+IF\s+(success|failure|passing|failing)")
                .ok()
                .and_then(|re| re.captures(task_text))
            {
                clean_task_text = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
                let condition_type = caps.get(2).map(|m| m.as_str()).unwrap_or("success");

                condition = Some(StepCondition {
                    step_id: "previous".to_string(),
                    operator: if condition_type == "success" || condition_type == "passing" {
                        ConditionOperator::IfSuccess
                    } else {
                        ConditionOperator::IfFailure
                    },
                    value: None,
                });
            }
        }

        // Parse goblinId: task format
        let mut goblin_id = default_goblin_id.unwrap_or("unknown").to_string();
        let mut task = clean_task_text.clone();

        if let Some(colon_idx) = clean_task_text.find(':') {
            if colon_idx > 0 && colon_idx < 30 {
                let potential_goblin_id = &clean_task_text[..colon_idx].trim();

                if !potential_goblin_id.contains(' ') && potential_goblin_id.len() < 30 {
                    goblin_id = potential_goblin_id.to_string();
                    task = clean_task_text[colon_idx + 1..].trim().to_string();
                }
            }
        }

        Ok(OrchestrationStep {
            id: step_id,
            goblin_id,
            task,
            dependencies: vec![],
            condition,
            status: StepStatus::Pending,
            result: None,
        })
    }

    /// Calculate number of parallel execution batches
    fn calculate_batches(steps: &[OrchestrationStep]) -> usize {
        let max_depth = steps.iter()
            .map(|step| Self::get_step_depth(step, steps))
            .max()
            .unwrap_or(0);

        max_depth + 1
    }

    /// Get execution depth of step (based on dependencies)
    fn get_step_depth(step: &OrchestrationStep, all_steps: &[OrchestrationStep]) -> usize {
        if step.dependencies.is_empty() {
            return 0;
        }

        let depths_of_deps: Vec<usize> = step.dependencies.iter()
            .filter_map(|dep_id| {
                all_steps.iter()
                    .find(|s| &s.id == dep_id)
                    .map(|dep_step| Self::get_step_depth(dep_step, all_steps) + 1)
            })
            .collect();

        depths_of_deps.into_iter().max().unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_sequential() {
        let plan = OrchestrationParser::parse("build THEN test", Some("websmith")).unwrap();
        assert_eq!(plan.steps.len(), 2);
        assert_eq!(plan.steps[0].task, "build");
        assert_eq!(plan.steps[1].task, "test");
        assert!(plan.steps[1].dependencies.contains(&plan.steps[0].id));
    }

    #[test]
    fn test_parallel_tasks() {
        let plan = OrchestrationParser::parse("lint AND test AND build", Some("websmith")).unwrap();
        assert_eq!(plan.steps.len(), 3);
        assert!(plan.steps[0].dependencies.is_empty());
        assert!(plan.steps[1].dependencies.is_empty());
        assert!(plan.steps[2].dependencies.is_empty());
    }

    #[test]
    fn test_conditional() {
        let plan = OrchestrationParser::parse("test THEN deploy IF_SUCCESS", Some("websmith")).unwrap();
        assert_eq!(plan.steps.len(), 2);
        assert!(plan.steps[1].condition.is_some());
    }
}
