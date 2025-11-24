-- ReimburseMe Database Schema
-- Bootstrap SQL for production deployment

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends auth_users from auth system)
CREATE TABLE IF NOT EXISTS auth_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    subscription_status VARCHAR(20) DEFAULT 'incomplete',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    merchant_name VARCHAR(255) NOT NULL,
    receipt_date DATE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('Meals', 'Travel', 'Supplies', 'Other')),
    currency VARCHAR(3) DEFAULT 'USD',
    note TEXT,
    needs_review BOOLEAN DEFAULT FALSE,
    is_duplicate BOOLEAN DEFAULT FALSE,
    confidence DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    title VARCHAR(255),
    total_amount DECIMAL(10,2) NOT NULL,
    receipt_count INTEGER DEFAULT 0,
    pdf_url TEXT,
    csv_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company settings table
CREATE TABLE IF NOT EXISTS company_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    address_line_1 VARCHAR(255),
    address_line_2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United States',
    approver_name VARCHAR(255),
    approver_email VARCHAR(255),
    department VARCHAR(100),
    cost_center VARCHAR(100),
    notes TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Receipt items table (for detailed line items)
CREATE TABLE IF NOT EXISTS receipts_items (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant ON receipts(merchant_name);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_period ON reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_default ON company_settings(user_id, is_default);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_receipts_items_receipt_id ON receipts_items(receipt_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_receipts_user_date ON receipts(user_id, receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_user_category ON receipts(user_id, category);
CREATE INDEX IF NOT EXISTS idx_receipts_duplicate_check ON receipts(user_id, merchant_name, amount, receipt_date);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_fts ON receipts USING gin(to_tsvector('english', merchant_name));
CREATE INDEX IF NOT EXISTS idx_receipts_notes_fts ON receipts USING gin(to_tsvector('english', COALESCE(note, '')));

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_auth_users_updated_at'
    ) THEN
        CREATE TRIGGER update_auth_users_updated_at
            BEFORE UPDATE ON auth_users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_receipts_updated_at'
    ) THEN
        CREATE TRIGGER update_receipts_updated_at
            BEFORE UPDATE ON receipts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_company_settings_updated_at'
    ) THEN
        CREATE TRIGGER update_company_settings_updated_at
            BEFORE UPDATE ON company_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;

-- Insert default company settings for existing users (if any)
INSERT INTO company_settings (user_id, company_name, is_default)
SELECT id, 'Default Company', TRUE
FROM auth_users
WHERE id NOT IN (SELECT DISTINCT user_id FROM company_settings)
ON CONFLICT DO NOTHING;

-- Sample data for development (only if no data exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth_users LIMIT 1) THEN
        -- Insert sample user
        INSERT INTO auth_users (email, first_name, last_name, subscription_status)
        VALUES ('admin@reimbursemeai.com', 'Admin', 'User', 'active');
        
        -- Insert sample company settings
        INSERT INTO company_settings (user_id, company_name, address_line_1, city, state, zip_code, approver_name, approver_email, is_default)
        VALUES (1, 'ReimburseMe Inc', '123 Business St', 'San Francisco', 'CA', '94105', 'Jane Smith', 'jane@reimbursemeai.com', TRUE);
    END IF;
END $$;
