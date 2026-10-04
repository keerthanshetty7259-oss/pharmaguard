-- PharmaGuard database schema (safe to run repeatedly)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  age        INTEGER      NOT NULL CHECK (age >= 0 AND age <= 130),
  gender     VARCHAR(20)  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);

CREATE TABLE IF NOT EXISTS prescriptions (
  id         SERIAL PRIMARY KEY,
  member_id  INTEGER     NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  source     VARCHAR(10) NOT NULL CHECK (source IN ('image', 'manual')),
  filename   TEXT,
  ocr_text   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_member ON prescriptions(member_id);

CREATE TABLE IF NOT EXISTS medicines (
  id                SERIAL PRIMARY KEY,
  member_id         INTEGER      NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  prescription_id   INTEGER      REFERENCES prescriptions(id) ON DELETE SET NULL,
  original_name     VARCHAR(255) NOT NULL,
  standardized_name VARCHAR(500) NOT NULL,
  rxcui             VARCHAR(20)  NOT NULL,
  ingredient_rxcuis TEXT[]       NOT NULL DEFAULT '{}',
  ingredient_names  TEXT[]       NOT NULL DEFAULT '{}',
  dosage            VARCHAR(100),
  frequency         VARCHAR(100),
  status            VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'stopped')),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_medicines_member ON medicines(member_id);
CREATE INDEX IF NOT EXISTS idx_medicines_status ON medicines(status);

-- Interaction results found when a medicine was added (medicine_a_id < medicine_b_id)
CREATE TABLE IF NOT EXISTS interaction_results (
  id            SERIAL PRIMARY KEY,
  medicine_a_id INTEGER      NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  medicine_b_id INTEGER      NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  scope         VARCHAR(10)  NOT NULL CHECK (scope IN ('self', 'family')),
  drug_a        VARCHAR(255) NOT NULL,
  drug_b        VARCHAR(255) NOT NULL,
  severity      VARCHAR(20)  NOT NULL,
  evidence      TEXT,
  source        VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (medicine_a_id, medicine_b_id, drug_a, drug_b)
);

-- Duplicate results found when a medicine was added (medicine_a_id < medicine_b_id)
CREATE TABLE IF NOT EXISTS duplicate_results (
  id              SERIAL PRIMARY KEY,
  medicine_a_id   INTEGER     NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  medicine_b_id   INTEGER     NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  scope           VARCHAR(10) NOT NULL CHECK (scope IN ('self', 'family')),
  ingredient_name TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (medicine_a_id, medicine_b_id, ingredient_name)
);

-- Documented drug-drug interaction pairs (loaded from DDInter + a small starter set).
-- name_a < name_b always (normalised, lower case) so a pair is stored once.
CREATE TABLE IF NOT EXISTS drug_interactions (
  id       SERIAL PRIMARY KEY,
  name_a   VARCHAR(255) NOT NULL,
  name_b   VARCHAR(255) NOT NULL,
  label_a  VARCHAR(255) NOT NULL,
  label_b  VARCHAR(255) NOT NULL,
  severity VARCHAR(20)  NOT NULL,
  note     TEXT,
  source   VARCHAR(100) NOT NULL,
  UNIQUE (name_a, name_b)
);
CREATE INDEX IF NOT EXISTS idx_drug_interactions_pair ON drug_interactions(name_a, name_b);
