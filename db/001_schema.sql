CREATE TABLE IF NOT EXISTS report_configs (id SERIAL PRIMARY KEY, report_name VARCHAR(100) NOT NULL UNIQUE, file_pattern VARCHAR(255) NOT NULL, required_columns JSONB NOT NULL, unique_key JSONB NOT NULL, column_mapping JSONB NOT NULL,
    schedule        VARCHAR(50) DEFAULT '0 6 * * *',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runs (
    id              SERIAL PRIMARY KEY,
    trigger_type    VARCHAR(20) NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'upload')),
    status          VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
    started_at      TIMESTAMP DEFAULT NOW(),
    ended_at        TIMESTAMP,
    total_files     INTEGER DEFAULT 0,
    success_files   INTEGER DEFAULT 0,
    failed_files    INTEGER DEFAULT 0,
    total_rows      INTEGER DEFAULT 0,
    imported_rows   INTEGER DEFAULT 0,
    rejected_rows   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS files (
    id              SERIAL PRIMARY KEY,
    run_id          INTEGER NOT NULL REFERENCES runs(id),
    report_config_id INTEGER NOT NULL REFERENCES report_configs(id),
    file_name       VARCHAR(500) NOT NULL,
    file_hash       VARCHAR(64) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'duplicate')),
    total_rows      INTEGER DEFAULT 0,
    imported_rows   INTEGER DEFAULT 0,
    rejected_rows   INTEGER DEFAULT 0,
    error_message   TEXT,
    processed_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_hash ON files(file_hash);

CREATE TABLE IF NOT EXISTS stg_vehicle_sales (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    invoice_no      VARCHAR(100),
    invoice_date    DATE,
    customer_name   VARCHAR(255),
    vehicle_model   VARCHAR(255),
    variant         VARCHAR(255),
    color           VARCHAR(100),
    chassis_no      VARCHAR(100),
    engine_no       VARCHAR(100),
    sale_amount     NUMERIC(12,2),
    tax_amount      NUMERIC(12,2),
    total_amount    NUMERIC(12,2),
    payment_mode    VARCHAR(50),
    salesperson     VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stg_service_transactions (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    job_card_no     VARCHAR(100),
    job_card_date   DATE,
    customer_name   VARCHAR(255),
    vehicle_reg_no  VARCHAR(100),
    vehicle_model   VARCHAR(255),
    service_type    VARCHAR(100),
    labour_amount   NUMERIC(12,2),
    parts_amount    NUMERIC(12,2),
    total_amount    NUMERIC(12,2),
    service_advisor VARCHAR(255),
    status          VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stg_spare_parts (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    part_no         VARCHAR(100),
    part_name       VARCHAR(255),
    category        VARCHAR(100),
    quantity        INTEGER,
    unit_price      NUMERIC(12,2),
    total_price     NUMERIC(12,2),
    invoice_no      VARCHAR(100),
    invoice_date    DATE,
    customer_name   VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stg_insurance_renewals (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    policy_no       VARCHAR(100),
    customer_name   VARCHAR(255),
    vehicle_reg_no  VARCHAR(100),
    vehicle_model   VARCHAR(255),
    insurer         VARCHAR(255),
    premium_amount  NUMERIC(12,2),
    policy_start    DATE,
    policy_end      DATE,
    renewal_status  VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_sales (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    invoice_no      VARCHAR(100) NOT NULL,
    invoice_date    DATE,
    customer_name   VARCHAR(255),
    vehicle_model   VARCHAR(255),
    variant         VARCHAR(255),
    color           VARCHAR(100),
    chassis_no      VARCHAR(100),
    engine_no       VARCHAR(100),
    sale_amount     NUMERIC(12,2),
    tax_amount      NUMERIC(12,2),
    total_amount    NUMERIC(12,2),
    payment_mode    VARCHAR(50),
    salesperson     VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(invoice_no)
);

CREATE TABLE IF NOT EXISTS service_transactions (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    job_card_no     VARCHAR(100) NOT NULL,
    job_card_date   DATE,
    customer_name   VARCHAR(255),
    vehicle_reg_no  VARCHAR(100),
    vehicle_model   VARCHAR(255),
    service_type    VARCHAR(100),
    labour_amount   NUMERIC(12,2),
    parts_amount    NUMERIC(12,2),
    total_amount    NUMERIC(12,2),
    service_advisor VARCHAR(255),
    status          VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(job_card_no)
);

CREATE TABLE IF NOT EXISTS spare_parts (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    part_no         VARCHAR(100) NOT NULL,
    part_name       VARCHAR(255),
    category        VARCHAR(100),
    quantity        INTEGER,
    unit_price      NUMERIC(12,2),
    total_price     NUMERIC(12,2),
    invoice_no      VARCHAR(100),
    invoice_date    DATE,
    customer_name   VARCHAR(255),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(part_no, invoice_no)
);

CREATE TABLE IF NOT EXISTS insurance_renewals (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    policy_no       VARCHAR(100) NOT NULL,
    customer_name   VARCHAR(255),
    vehicle_reg_no  VARCHAR(100),
    vehicle_model   VARCHAR(255),
    insurer         VARCHAR(255),
    premium_amount  NUMERIC(12,2),
    policy_start    DATE,
    policy_end      DATE,
    renewal_status  VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(policy_no)
);

CREATE TABLE IF NOT EXISTS rejected_rows (
    id              SERIAL PRIMARY KEY,
    file_id         INTEGER NOT NULL REFERENCES files(id),
    row_number      INTEGER NOT NULL,
    row_data        JSONB NOT NULL,
    rejection_reason TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_logs (
    id              SERIAL PRIMARY KEY,
    run_id          INTEGER REFERENCES runs(id),
    level           VARCHAR(10) NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    message         TEXT NOT NULL,
    details         JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_logs_run_id ON run_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_rejected_rows_file_id ON rejected_rows(file_id);
