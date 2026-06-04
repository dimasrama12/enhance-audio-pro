use chrono::Utc;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
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
    pub progress: i64,
    pub error_message: Option<String>,
    pub output_format: String,
    pub bitrate: String,
    pub output_filepath: Option<String>,
    pub sample_rate: String,
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

    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_else(|| "wav".to_string());

    conn.execute(
        "INSERT INTO queue_jobs
            (id, filename, filepath, destination, size_bytes, media_type, status, output_format, created_at, updated_at)
         VALUES (?1, ?2, ?3, '', ?4, ?5, 'pending', ?6, ?7, ?8)",
        params![id, filename, filepath, size_bytes, media_type, ext, now, now],
    )?;

    Ok(QueueJob {
        id,
        filename: filename.to_string(),
        filepath: filepath.to_string(),
        destination: String::new(),
        size_bytes,
        media_type: media_type.to_string(),
        status: "pending".to_string(),
        progress: 0,
        error_message: None,
        output_format: ext,
        bitrate: String::new(),
        output_filepath: None,
        sample_rate: "44100".to_string(),
        created_at: now.clone(),
        updated_at: now,
    })
}

pub fn get_all_jobs(conn: &Connection) -> Result<Vec<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status,
                progress, error_message, output_format, bitrate, output_filepath,
                sample_rate, created_at, updated_at
         FROM queue_jobs
         WHERE archived = 0
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
                progress: row.get(7)?,
                error_message: row.get(8)?,
                output_format: row.get::<_, Option<String>>(9)?
                    .unwrap_or_else(|| "wav".to_string()),
                bitrate: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                output_filepath: row.get(11)?,
                sample_rate: row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "44100".to_string()),
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(jobs)
}

pub fn get_job_by_id(conn: &Connection, id: &str) -> Result<Option<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status,
                progress, error_message, output_format, bitrate, output_filepath,
                sample_rate, created_at, updated_at
         FROM queue_jobs WHERE id = ?1",
    )?;

    let mut rows = stmt.query_map([id], |row| {
        Ok(QueueJob {
            id: row.get(0)?,
            filename: row.get(1)?,
            filepath: row.get(2)?,
            destination: row.get(3)?,
            size_bytes: row.get(4)?,
            media_type: row.get(5)?,
            status: row.get(6)?,
            progress: row.get(7)?,
            error_message: row.get(8)?,
            output_format: row.get::<_, Option<String>>(9)?
                .unwrap_or_else(|| "wav".to_string()),
            bitrate: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
            output_filepath: row.get(11)?,
            sample_rate: row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "44100".to_string()),
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    })?;

    rows.next().transpose()
}

pub fn update_job_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now, id],
    )?;
    Ok(())
}

pub fn update_job_error(conn: &Connection, id: &str, message: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET status = 'error', error_message = ?1, updated_at = ?2 WHERE id = ?3",
        params![message, now, id],
    )?;
    Ok(())
}

pub fn update_job_output_format(conn: &Connection, id: &str, format: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET output_format = ?1, updated_at = ?2 WHERE id = ?3",
        params![format, now, id],
    )?;
    Ok(())
}

pub fn update_job_bitrate(conn: &Connection, id: &str, bitrate: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET bitrate = ?1, updated_at = ?2 WHERE id = ?3",
        params![bitrate, now, id],
    )?;
    Ok(())
}

pub fn update_job_sample_rate(conn: &Connection, id: &str, sample_rate: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET sample_rate = ?1, updated_at = ?2 WHERE id = ?3",
        params![sample_rate, now, id],
    )?;
    Ok(())
}

pub fn update_job_output_filepath(conn: &Connection, id: &str, filepath: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE queue_jobs SET output_filepath = ?1, updated_at = ?2 WHERE id = ?3",
        params![filepath, now, id],
    )?;
    Ok(())
}

pub fn get_recent_jobs(conn: &Connection, limit: i64) -> Result<Vec<QueueJob>> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, filepath, destination, size_bytes, media_type, status,
                progress, error_message, output_format, bitrate, output_filepath,
                sample_rate, created_at, updated_at
         FROM queue_jobs
         WHERE status IN ('done', 'error')
         ORDER BY updated_at DESC
         LIMIT ?1",
    )?;

    let jobs = stmt
        .query_map([limit], |row| {
            Ok(QueueJob {
                id: row.get(0)?,
                filename: row.get(1)?,
                filepath: row.get(2)?,
                destination: row.get(3)?,
                size_bytes: row.get(4)?,
                media_type: row.get(5)?,
                status: row.get(6)?,
                progress: row.get(7)?,
                error_message: row.get(8)?,
                output_format: row.get::<_, Option<String>>(9)?
                    .unwrap_or_else(|| "wav".to_string()),
                bitrate: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                output_filepath: row.get(11)?,
                sample_rate: row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "44100".to_string()),
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;

    Ok(jobs)
}

pub fn count_active_jobs_by_type(conn: &Connection, media_type: &str) -> Result<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM queue_jobs
         WHERE status IN ('pending', 'processing') AND media_type = ?1 AND archived = 0",
        [media_type],
        |r| r.get(0),
    )
}

pub fn archive_job(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("UPDATE queue_jobs SET archived = 1 WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn archive_all_jobs(conn: &Connection) -> Result<()> {
    conn.execute("UPDATE queue_jobs SET archived = 1 WHERE archived = 0", [])?;
    Ok(())
}

pub fn delete_job_by_id(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM queue_jobs WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn delete_all_history(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM queue_jobs WHERE status IN ('done', 'error')", [])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations::run_migrations;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn test_get_job_by_id_returns_inserted_job() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/a.mp3", "a.mp3", 1024, "audio").unwrap();
        let found = get_job_by_id(&conn, &job.id).unwrap().unwrap();
        assert_eq!(found.id, job.id);
        assert_eq!(found.progress, 0);
        assert_eq!(found.error_message.is_none(), true);
        assert_eq!(found.output_format, "mp3");
    }

    #[test]
    fn test_get_job_by_id_returns_none_for_unknown_id() {
        let conn = setup();
        let found = get_job_by_id(&conn, "nonexistent-id").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_update_job_status_changes_status() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/b.mp3", "b.mp3", 512, "audio").unwrap();
        update_job_status(&conn, &job.id, "processing").unwrap();
        let jobs = get_all_jobs(&conn).unwrap();
        assert_eq!(jobs[0].status, "processing");
    }

    #[test]
    fn test_update_job_error_sets_status_and_message() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/c.mp3", "c.mp3", 256, "audio").unwrap();
        update_job_error(&conn, &job.id, "model not loaded").unwrap();
        let jobs = get_all_jobs(&conn).unwrap();
        assert_eq!(jobs[0].status, "error");
        assert_eq!(jobs[0].error_message.as_deref(), Some("model not loaded"));
    }

    #[test]
    fn test_update_job_output_format() {
        let conn = setup();
        let job = insert_job(&conn, "/tmp/d.wav", "d.wav", 100, "audio").unwrap();
        assert_eq!(job.output_format, "wav");
        update_job_output_format(&conn, &job.id, "mp3").unwrap();
        let found = get_job_by_id(&conn, &job.id).unwrap().unwrap();
        assert_eq!(found.output_format, "mp3");
    }

    #[test]
    fn test_count_active_jobs_by_type() {
        let conn = setup();
        insert_job(&conn, "/tmp/a.mp3", "a.mp3", 100, "audio").unwrap();
        insert_job(&conn, "/tmp/b.mp3", "b.mp3", 100, "audio").unwrap();
        insert_job(&conn, "/tmp/v.mp4", "v.mp4", 100, "video").unwrap();
        let audio = count_active_jobs_by_type(&conn, "audio").unwrap();
        let video = count_active_jobs_by_type(&conn, "video").unwrap();
        assert_eq!(audio, 2);
        assert_eq!(video, 1);
    }
}
