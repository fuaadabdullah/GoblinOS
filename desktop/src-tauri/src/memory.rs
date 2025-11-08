use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::path::Path;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MemoryEntry {
    pub id: String,
    pub goblin: String,
    pub task: String,
    pub response: String,
    pub timestamp: i64,
    pub kpis: Option<String>, // JSON string
}

pub struct MemoryStore {
    pool: SqlitePool,
}

impl MemoryStore {
    pub async fn new(db_path: &str) -> Result<Self, sqlx::Error> {
        // Ensure parent directory exists
        if let Some(parent) = Path::new(db_path).parent() {
            std::fs::create_dir_all(parent).ok();
        }

        // Use file-based URI form with create_if_missing to ensure DB is created
        let connection_string = format!("sqlite://{}", db_path);
        let options = SqliteConnectOptions::from_str(&connection_string)?
            .create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;

        // Create table if not exists
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS memory (
                id TEXT PRIMARY KEY,
                goblin TEXT NOT NULL,
                task TEXT NOT NULL,
                response TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                kpis TEXT
            )
            "#,
        )
        .execute(&pool)
        .await?;

        // Create indexes for common queries
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_memory_goblin ON memory(goblin)")
            .execute(&pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory(timestamp)")
            .execute(&pool)
            .await?;

        Ok(Self { pool })
    }

    pub async fn save(&self, entry: &MemoryEntry) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO memory (id, goblin, task, response, timestamp, kpis)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&entry.id)
        .bind(&entry.goblin)
        .bind(&entry.task)
        .bind(&entry.response)
        .bind(entry.timestamp)
        .bind(&entry.kpis)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_history(
        &self,
        goblin: &str,
        limit: i32,
    ) -> Result<Vec<MemoryEntry>, sqlx::Error> {
        sqlx::query_as::<_, MemoryEntry>(
            r#"
            SELECT * FROM memory
            WHERE goblin = ?
            ORDER BY timestamp DESC
            LIMIT ?
            "#,
        )
        .bind(goblin)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn get_all_history(&self, limit: i32) -> Result<Vec<MemoryEntry>, sqlx::Error> {
        sqlx::query_as::<_, MemoryEntry>(
            r#"
            SELECT * FROM memory
            ORDER BY timestamp DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn clear_history(&self, goblin: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM memory WHERE goblin = ?")
            .bind(goblin)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_memory_store() {
        let store = MemoryStore::new(":memory:").await.unwrap();

        let entry = MemoryEntry {
            id: "test-1".to_string(),
            goblin: "vanta-lumin".to_string(),
            task: "test task".to_string(),
            response: "test response".to_string(),
            timestamp: 1234567890,
            kpis: Some(r#"{"duration_ms": 100}"#.to_string()),
        };

        store.save(&entry).await.unwrap();

        let history = store.get_history("vanta-lumin", 10).await.unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].id, "test-1");
    }
}
