use chrono::Utc;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueueJob {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    pub destination: String,
    pub size_bytes: i64,
    pub media_type: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn insert_job(
    conn: &Connection,
    filepath: &str,
    filename: &str,
    size_bytes: i64,
    media_type: &str,
) -> Result<QueueJob> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO queue_jobs
            (id, filename, filepath, destination, size_bytes, media_type, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, '', ?4, ?5, 'pending', ?6, ?7)",
        params![id, filename, filepath, size_bytes, media_type, now, now],
    )?;

    Ok(QueueJob {
        id,
        filename: filename.to_string(),
        filepath: filepath.to_string(),
        destination: String::new(),
        size_bytes,
        media_type: media_type.to_string(),
        status: "pending".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_all_jobs(conn: &Connection) -> Result<Vec<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status, created_at, updated_at
         FROM queue_jobs
         ORDER BY created_at ASC",
    )?;

    let jobs = stmt
        .query_map([], |row| {
            Ok(QueueJob {
                id: row.get(0)?,
                filename: row.get(1)?,
                filepath: row.get(2)?,
                destination: row.get(3)?,
                size_bytes: row.get(4)?,
                media_type: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(jobs)
}
