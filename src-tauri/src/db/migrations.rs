use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS queue_jobs (
            id            TEXT    PRIMARY KEY NOT NULL,
            filename      TEXT    NOT NULL,
            filepath      TEXT    NOT NULL,
            destination   TEXT    NOT NULL DEFAULT '',
            size_bytes    INTEGER NOT NULL DEFAULT 0,
            media_type    TEXT    NOT NULL DEFAULT 'audio',
            status        TEXT    NOT NULL DEFAULT 'pending',
            progress      INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            created_at    TEXT    NOT NULL,
            updated_at    TEXT    NOT NULL
        );",
    )?;
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN error_message TEXT;",
    );
    // Phase 4: per-job output format selection
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN output_format TEXT NOT NULL DEFAULT 'wav';",
    );
    Ok(())
}
