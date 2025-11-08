// Cost tracking module - tracks API costs for different providers

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostConfig {
    pub provider: String,
    pub model: String,
    pub input_cost_per_1k: f64,  // USD per 1K tokens
    pub output_cost_per_1k: f64, // USD per 1K tokens
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCost {
    pub task_id: String,
    pub provider: String,
    pub model: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub input_cost: f64,
    pub output_cost: f64,
    pub total_cost: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostSummary {
    pub total_tasks: usize,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cost: f64,
    pub cost_by_provider: HashMap<String, f64>,
    pub cost_by_model: HashMap<String, f64>,
}

pub struct CostTracker {
    pricing: HashMap<String, CostConfig>,
    history: Vec<TaskCost>,
}

impl CostTracker {
    pub fn new() -> Self {
        let mut pricing = HashMap::new();

        // OpenAI Pricing (as of Nov 2024)
        pricing.insert(
            "openai:gpt-4-turbo-preview".to_string(),
            CostConfig {
                provider: "openai".to_string(),
                model: "gpt-4-turbo-preview".to_string(),
                input_cost_per_1k: 0.01,
                output_cost_per_1k: 0.03,
            },
        );
        pricing.insert(
            "openai:gpt-4".to_string(),
            CostConfig {
                provider: "openai".to_string(),
                model: "gpt-4".to_string(),
                input_cost_per_1k: 0.03,
                output_cost_per_1k: 0.06,
            },
        );
        pricing.insert(
            "openai:gpt-3.5-turbo".to_string(),
            CostConfig {
                provider: "openai".to_string(),
                model: "gpt-3.5-turbo".to_string(),
                input_cost_per_1k: 0.0005,
                output_cost_per_1k: 0.0015,
            },
        );

        // Anthropic Pricing
        pricing.insert(
            "anthropic:claude-3-5-sonnet-20241022".to_string(),
            CostConfig {
                provider: "anthropic".to_string(),
                model: "claude-3-5-sonnet-20241022".to_string(),
                input_cost_per_1k: 0.003,
                output_cost_per_1k: 0.015,
            },
        );
        pricing.insert(
            "anthropic:claude-3-opus-20240229".to_string(),
            CostConfig {
                provider: "anthropic".to_string(),
                model: "claude-3-opus-20240229".to_string(),
                input_cost_per_1k: 0.015,
                output_cost_per_1k: 0.075,
            },
        );

        // Google Gemini Pricing
        pricing.insert(
            "gemini:gemini-1.5-pro-latest".to_string(),
            CostConfig {
                provider: "gemini".to_string(),
                model: "gemini-1.5-pro-latest".to_string(),
                input_cost_per_1k: 0.00125,
                output_cost_per_1k: 0.005,
            },
        );
        pricing.insert(
            "gemini:gemini-1.5-flash-latest".to_string(),
            CostConfig {
                provider: "gemini".to_string(),
                model: "gemini-1.5-flash-latest".to_string(),
                input_cost_per_1k: 0.000075,
                output_cost_per_1k: 0.0003,
            },
        );

        // Ollama (local, free)
        pricing.insert(
            "ollama:qwen2.5:3b".to_string(),
            CostConfig {
                provider: "ollama".to_string(),
                model: "qwen2.5:3b".to_string(),
                input_cost_per_1k: 0.0,
                output_cost_per_1k: 0.0,
            },
        );

        Self {
            pricing,
            history: vec![],
        }
    }

    pub fn record_task(
        &mut self,
        task_id: String,
        provider: String,
        model: String,
        input_tokens: u32,
        output_tokens: u32,
    ) -> TaskCost {
        let pricing_key = format!("{}:{}", provider, model);

        let (input_cost, output_cost) = if let Some(config) = self.pricing.get(&pricing_key) {
            let input_cost = (input_tokens as f64 / 1000.0) * config.input_cost_per_1k;
            let output_cost = (output_tokens as f64 / 1000.0) * config.output_cost_per_1k;
            (input_cost, output_cost)
        } else {
            // Unknown model, assume free (likely local model)
            (0.0, 0.0)
        };

        let task_cost = TaskCost {
            task_id,
            provider: provider.clone(),
            model: model.clone(),
            input_tokens,
            output_tokens,
            input_cost,
            output_cost,
            total_cost: input_cost + output_cost,
            timestamp: chrono::Utc::now(),
        };

        self.history.push(task_cost.clone());
        task_cost
    }

    pub fn get_summary(&self) -> CostSummary {
        let mut total_input_tokens = 0u64;
        let mut total_output_tokens = 0u64;
        let mut total_cost = 0.0;
        let mut cost_by_provider: HashMap<String, f64> = HashMap::new();
        let mut cost_by_model: HashMap<String, f64> = HashMap::new();

        for task in &self.history {
            total_input_tokens += task.input_tokens as u64;
            total_output_tokens += task.output_tokens as u64;
            total_cost += task.total_cost;

            *cost_by_provider.entry(task.provider.clone()).or_insert(0.0) += task.total_cost;
            *cost_by_model.entry(task.model.clone()).or_insert(0.0) += task.total_cost;
        }

        CostSummary {
            total_tasks: self.history.len(),
            total_input_tokens,
            total_output_tokens,
            total_cost,
            cost_by_provider,
            cost_by_model,
        }
    }

    pub fn get_history(&self) -> &[TaskCost] {
        &self.history
    }

    pub fn clear_history(&mut self) {
        self.history.clear();
    }
}

impl Default for CostTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cost_calculation() {
        let mut tracker = CostTracker::new();

        let cost = tracker.record_task(
            "task1".to_string(),
            "openai".to_string(),
            "gpt-4-turbo-preview".to_string(),
            1000,
            500,
        );

        // 1000 tokens * $0.01/1k = $0.01
        // 500 tokens * $0.03/1k = $0.015
        // Total = $0.025
        assert!((cost.total_cost - 0.025).abs() < 0.001);
    }

    #[test]
    fn test_summary() {
        let mut tracker = CostTracker::new();

        tracker.record_task(
            "task1".to_string(),
            "openai".to_string(),
            "gpt-4".to_string(),
            1000,
            500,
        );

        tracker.record_task(
            "task2".to_string(),
            "anthropic".to_string(),
            "claude-3-5-sonnet-20241022".to_string(),
            2000,
            1000,
        );

        let summary = tracker.get_summary();

        assert_eq!(summary.total_tasks, 2);
        assert_eq!(summary.total_input_tokens, 3000);
        assert_eq!(summary.total_output_tokens, 1500);
        assert!(summary.cost_by_provider.contains_key("openai"));
        assert!(summary.cost_by_provider.contains_key("anthropic"));
    }

    #[test]
    fn test_free_models() {
        let mut tracker = CostTracker::new();

        let cost = tracker.record_task(
            "task1".to_string(),
            "ollama".to_string(),
            "qwen2.5:3b".to_string(),
            10000,
            5000,
        );

        assert_eq!(cost.total_cost, 0.0);
    }
}
