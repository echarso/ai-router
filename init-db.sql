-- Platform Database Schema
-- This file is executed automatically when PostgreSQL container starts

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)
-- Connect to platform_db
\c platform_db;

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);

-- API Keys table (metadata only - tokens stored in OpenBao)
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    reference_name VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(project_id, reference_name)
);

-- Rate Limit Policies
CREATE TABLE IF NOT EXISTS rate_limit_policies (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    policy_name VARCHAR(255) NOT NULL,
    requests_per_second INTEGER,
    requests_per_minute INTEGER,
    requests_per_hour INTEGER,
    burst_limit INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_key_id, policy_name)
);

-- Traffic Policies
CREATE TABLE IF NOT EXISTS traffic_policies (
    id SERIAL PRIMARY KEY,
    api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    policy_name VARCHAR(255) NOT NULL,
    daily_quota INTEGER,
    monthly_quota INTEGER,
    daily_cost_usd NUMERIC,
    monthly_cost_usd NUMERIC,
    throttling_rules JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(api_key_id, policy_name)
);

-- If traffic_policies existed before cost limits were added, extend it
ALTER TABLE traffic_policies
  ADD COLUMN IF NOT EXISTS daily_cost_usd NUMERIC;

ALTER TABLE traffic_policies
  ADD COLUMN IF NOT EXISTS monthly_cost_usd NUMERIC;

-- User-Organization assignments
CREATE TABLE IF NOT EXISTS user_organizations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL, -- Keycloak user ID
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OA', 'PA')), -- OA = Organization Admin, PA = Project Admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, organization_id, role)
);

-- User-Project assignments
CREATE TABLE IF NOT EXISTS user_projects (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL, -- Keycloak user ID
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('PA')), -- PA = Project Admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, project_id)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_policies_api_key ON rate_limit_policies(api_key_id);
CREATE INDEX IF NOT EXISTS idx_traffic_policies_api_key ON traffic_policies(api_key_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_user ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project ON user_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- =========================
-- Extensions for API-KEY-UI.txt requirements
-- =========================

-- 1) API keys are org-scoped and can be assigned to multiple projects.
-- Keep existing api_keys.project_id for backward compatibility, but add org scope + join table.
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS organization_id INTEGER;

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS expiration_days INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'api_keys_organization_id_fkey'
      AND table_name = 'api_keys'
  ) THEN
    ALTER TABLE api_keys
      ADD CONSTRAINT api_keys_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS api_key_projects (
  api_key_id INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (api_key_id, project_id)
);

-- One API key per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_key_projects_unique_project
ON api_key_projects(project_id);

-- Prefer uniqueness of reference_name within an organization (keep old UNIQUE(project_id, reference_name) too)
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_unique_ref_per_org
ON api_keys(organization_id, reference_name);

-- 2) OA must belong to exactly one organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_oa_per_user
ON user_organizations(user_id)
WHERE role = 'OA';

-- Extra indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_key_projects_project ON api_key_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_api_key_projects_api_key ON api_key_projects(api_key_id);
