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
    // Phase 6: per-job bitrate and output filepath tracking
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN bitrate TEXT NOT NULL DEFAULT '';",
    );
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN output_filepath TEXT;",
    );
    // Phase 8: per-job sample rate
    let _ = conn.execute_batch(
        "ALTER TABLE queue_jobs ADD COLUMN sample_rate TEXT NOT NULL DEFAULT '44100';",
    );
    Ok(())
}
