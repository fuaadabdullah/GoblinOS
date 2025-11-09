use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoblinsConfig {
    pub overmind: Overmind,
    pub guilds: Vec<Guild>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Overmind {
    pub name: String,
    pub title: String,
    pub brain: BrainConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainConfig {
    pub local: Option<Vec<String>>,
    pub routers: Option<Vec<String>>,
    pub embeddings: Option<String>,
    // Optional preferred model/router name for this goblin
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Guild {
    pub name: String,
    pub verbosity: String,
    pub charter: String,
    pub toolbelt: Option<Vec<Tool>>,
    pub members: Vec<GoblinMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    pub id: String,
    pub name: String,
    pub summary: String,
    pub owner: String,
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoblinMember {
    pub id: String,
    pub title: String,
    pub brain: BrainConfig,
    pub prompt: Option<PromptConfig>,
    pub responsibilities: Option<Vec<String>>,
    pub kpis: Option<Vec<String>>,
    pub tools: Option<ToolsConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptConfig {
    pub system: Option<String>,
    pub style: Option<Vec<String>>,
    pub examples: Option<Vec<HashMap<String, String>>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolsConfig {
    pub owned: Option<Vec<String>>,
    pub selection_rules: Option<Vec<SelectionRule>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRule {
    pub trigger: String,
    pub tool: String,
}

impl GoblinsConfig {
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let content = std::fs::read_to_string(path)?;
        let config: GoblinsConfig = serde_yaml::from_str(&content)?;
        Ok(config)
    }

    pub fn get_all_goblins(&self) -> Vec<GoblinInfo> {
        let mut goblins = Vec::new();

        for guild in &self.guilds {
            for member in &guild.members {
                goblins.push(GoblinInfo {
                    id: member.id.clone(),
                    name: Self::format_name(&member.id),
                    title: member.title.clone(),
                    guild: Some(guild.name.clone()),
                    responsibilities: member.responsibilities.clone().unwrap_or_default(),
                    brain: member.brain.clone(),
                });
            }
        }

        goblins
    }

    fn format_name(id: &str) -> String {
        id.split('-')
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoblinInfo {
    pub id: String,
    pub name: String,
    pub title: String,
    pub guild: Option<String>,
    pub responsibilities: Vec<String>,
    pub brain: BrainConfig,
}
