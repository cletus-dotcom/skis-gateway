"""PostgreSQL connection and schema for Supabase / Render."""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

# Render and some hosts use postgres://; psycopg2 requires postgresql://
_raw = os.environ.get("DATABASE_URL")
DATABASE_URL = _raw.replace("postgres://", "postgresql://", 1) if _raw and _raw.startswith("postgres://") else _raw

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    address TEXT NOT NULL,
    representative_name TEXT NOT NULL,
    email TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    app_software_name TEXT,
    amount TEXT NOT NULL,
    reference_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""

ALTER_APP_SOFTWARE_NAME_SQL = """
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS app_software_name TEXT;
"""


@contextmanager
def get_conn():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create submissions table if it does not exist; add app_software_name if missing."""
    if not DATABASE_URL:
        return
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(CREATE_TABLE_SQL)
            cur.execute(ALTER_APP_SOFTWARE_NAME_SQL)


def create_submission(company_name, address, representative_name, email, contact_number, app_software_name, amount):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO submissions (company_name, address, representative_name, email, contact_number, app_software_name, amount)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, company_name, address, representative_name, email, contact_number, app_software_name, amount, reference_number, created_at
                """,
                (company_name, address, representative_name, email, contact_number, app_software_name or None, amount),
            )
            return cur.fetchone()


def get_submission(submission_id):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, company_name, address, representative_name, email, contact_number, app_software_name, amount, reference_number, created_at FROM submissions WHERE id = %s",
                (str(submission_id),),
            )
            return cur.fetchone()


def set_reference_number(submission_id, reference_number):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "UPDATE submissions SET reference_number = %s WHERE id = %s RETURNING id",
                (reference_number, str(submission_id)),
            )
            return cur.fetchone()
