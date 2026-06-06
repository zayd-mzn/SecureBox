-- ============================================================
--  SecureBox — Database Schema
--  SQLite-compatible DDL
--  Generated from backend/app/models.py
-- ============================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER     PRIMARY KEY AUTOINCREMENT,
    username            VARCHAR(80)  NOT NULL UNIQUE,
    full_name           VARCHAR(200),
    email               VARCHAR(120) NOT NULL UNIQUE,
    phone               VARCHAR(50),
    preferences         JSON,
    password_hash       VARCHAR(255) NOT NULL,
    role                VARCHAR(50)  NOT NULL DEFAULT 'user',
    mfa_enabled         BOOLEAN      NOT NULL DEFAULT 0,
    mfa_secret          VARCHAR(32),
    is_active           BOOLEAN      NOT NULL DEFAULT 1,
    mfa_failed_attempts INTEGER      NOT NULL DEFAULT 0,
    failed_attempts     INTEGER      NOT NULL DEFAULT 0,
    locked_until        DATETIME,
    storage_quota       BIGINT       NOT NULL DEFAULT 5368709120,  -- 5 GB
    storage_used        BIGINT       NOT NULL DEFAULT 0,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    avatar_base64       TEXT,
    avatar_mime_type    VARCHAR(50),
    avatar_updated_at   DATETIME,
    reset_otp_hash      VARCHAR(255),
    reset_otp_expiry    DATETIME
);

-- ------------------------------------------------------------
-- workspaces  (declared before files / workspace_members)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
    id          INTEGER      PRIMARY KEY AUTOINCREMENT,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    admin_id    INTEGER      NOT NULL REFERENCES users(id),
    invite_code VARCHAR(16)  NOT NULL UNIQUE,
    is_active   BOOLEAN      NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- folders  (self-referencing, declared before files)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS folders (
    id         INTEGER      PRIMARY KEY AUTOINCREMENT,
    name       VARCHAR(255) NOT NULL,
    parent_id  INTEGER      REFERENCES folders(id),
    owner_id   INTEGER      NOT NULL REFERENCES users(id),
    is_deleted BOOLEAN      NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- files
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
    id                  INTEGER      PRIMARY KEY AUTOINCREMENT,
    filename            VARCHAR(255) NOT NULL,
    original_filename   VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    file_type           VARCHAR(100),
    size                BIGINT       NOT NULL,
    owner_id            INTEGER      NOT NULL REFERENCES users(id),
    folder_id           INTEGER      REFERENCES folders(id),
    workspace_id        INTEGER      REFERENCES workspaces(id),
    is_encrypted        BOOLEAN      NOT NULL DEFAULT 0,
    file_password_hash  VARCHAR(255),
    encryption_key      VARCHAR(255),
    is_shared           BOOLEAN      NOT NULL DEFAULT 0,
    is_deleted          BOOLEAN      NOT NULL DEFAULT 0,
    is_locked           BOOLEAN      NOT NULL DEFAULT 0,
    locked_by           INTEGER      REFERENCES users(id),
    locked_at           DATETIME,
    version             INTEGER      NOT NULL DEFAULT 1,
    checksum            VARCHAR(64),
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- file_versions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS file_versions (
    id             INTEGER      PRIMARY KEY AUTOINCREMENT,
    file_id        INTEGER      NOT NULL REFERENCES files(id),
    version_number INTEGER      NOT NULL,
    filename       VARCHAR(255) NOT NULL,
    file_path      VARCHAR(500) NOT NULL,
    size           BIGINT       NOT NULL,
    checksum       VARCHAR(64),
    author_id      INTEGER      NOT NULL REFERENCES users(id),
    comment        VARCHAR(500),
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- acls
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS acls (
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    file_id    INTEGER  NOT NULL REFERENCES files(id),
    user_id    INTEGER  NOT NULL REFERENCES users(id),
    can_read   BOOLEAN  NOT NULL DEFAULT 0,
    can_write  BOOLEAN  NOT NULL DEFAULT 0,
    can_delete BOOLEAN  NOT NULL DEFAULT 0,
    can_share  BOOLEAN  NOT NULL DEFAULT 0,
    granted_by INTEGER  NOT NULL REFERENCES users(id),
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logs (
    id         INTEGER      PRIMARY KEY AUTOINCREMENT,
    user       VARCHAR(80),
    action     VARCHAR(100) NOT NULL,
    resource   VARCHAR(255),
    ip_address VARCHAR(45),
    status     VARCHAR(20)  NOT NULL DEFAULT 'success',
    timestamp  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- deleted_files  (recycle bin)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deleted_files (
    id                    INTEGER      PRIMARY KEY AUTOINCREMENT,
    original_id           INTEGER,
    filename              VARCHAR(255) NOT NULL,
    original_filename     VARCHAR(255) NOT NULL,
    size                  BIGINT       NOT NULL,
    owner_id              INTEGER      NOT NULL REFERENCES users(id),
    file_type             VARCHAR(100),
    deleted_date          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    permanent_delete_days INTEGER      NOT NULL DEFAULT 30
);

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id            INTEGER      PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER      NOT NULL REFERENCES users(id),
    title         VARCHAR(200) NOT NULL,
    message       TEXT         NOT NULL,
    type          VARCHAR(50)  NOT NULL DEFAULT 'info',
    is_read       BOOLEAN      NOT NULL DEFAULT 0,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at       DATETIME,
    resource_type VARCHAR(50),
    resource_id   INTEGER
);

-- ------------------------------------------------------------
-- workspace_members
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspace_members (
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER  NOT NULL REFERENCES workspaces(id),
    user_id      INTEGER  NOT NULL REFERENCES users(id),
    joined_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

-- ============================================================
--  Indexes
-- ============================================================

-- users
CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- files
CREATE INDEX IF NOT EXISTS idx_files_owner_id    ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_folder_id   ON files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_workspace_id ON files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_files_is_deleted  ON files(is_deleted);

-- file_versions
CREATE INDEX IF NOT EXISTS idx_fv_file_id ON file_versions(file_id);

-- acls
CREATE INDEX IF NOT EXISTS idx_acls_file_id ON acls(file_id);
CREATE INDEX IF NOT EXISTS idx_acls_user_id ON acls(user_id);

-- logs
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_user      ON logs(user);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_user_id  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_is_read  ON notifications(is_read);

-- workspace_members
CREATE INDEX IF NOT EXISTS idx_wm_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user_id      ON workspace_members(user_id);
