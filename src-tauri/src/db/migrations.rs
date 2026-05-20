use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS queue_jobs (
            id          TEXT    PRIMARY KEY NOT NULL,
            filename    TEXT    NOT NULL,
            filepath    TEXT    NOT NULL,
            destination TEXT    NOT NULL DEFAULT '',
            size_bytes  INTEGER NOT NULL DEFAULT 0,
            media_type  TEXT    NOT NULL DEFAULT 'audio',
            status      TEXT    NOT NULL DEFAULT 'pending',
            created_at  TEXT    NOT NULL,
            updated_at  TEXT    NOT NULL
        );",
    )
}
