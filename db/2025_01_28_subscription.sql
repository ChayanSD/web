-- ReimburseMe Subscription System Migration
-- Date: 2025-01-28
-- Description: Add subscription tiers, Stripe integration, and trial management

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'premium'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'canceled', 'past_due', 'incomplete'));
  ELSE
    -- Column exists from bootstrap.sql, add CHECK constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'auth_users'::regclass
        AND a.attname = 'subscription_status'
        AND c.contype = 'c'
    ) THEN
      ALTER TABLE auth_users
        ADD CONSTRAINT subscription_status_check 
        CHECK (subscription_status IN ('trial', 'active', 'canceled', 'past_due', 'incomplete'));
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'subscription_ends_at'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN subscription_ends_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'trial_start'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN trial_start TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'trial_end'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN trial_end TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN stripe_customer_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN stripe_subscription_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN referral_code TEXT UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN referred_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'early_adopter'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN early_adopter BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auth_users' AND column_name = 'lifetime_discount'
  ) THEN
    ALTER TABLE auth_users
      ADD COLUMN lifetime_discount DECIMAL(5,2) DEFAULT 0.00;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS subscription_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  reset_date TIMESTAMPTZ DEFAULT NOW(),
  reset_day DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'subscription_usage'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_usage' AND column_name = 'reset_day'
  ) THEN
    ALTER TABLE subscription_usage
      ADD COLUMN reset_day DATE DEFAULT CURRENT_DATE;
    UPDATE subscription_usage
      SET reset_day = reset_date::DATE
      WHERE reset_day IS NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'subscription_usage'
      AND constraint_name = 'subscription_usage_user_feature_day_key'
  ) THEN
    ALTER TABLE subscription_usage
      ADD CONSTRAINT subscription_usage_user_feature_day_key
      UNIQUE (user_id, feature, reset_day);
  END IF;
END;
$$;

-- Create subscription_events table for audit trail
CREATE TABLE IF NOT EXISTS subscription_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_tier TEXT,
  new_tier TEXT,
  old_status TEXT,
  new_status TEXT,
  stripe_event_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create referral_tracking table
CREATE TABLE IF NOT EXISTS referral_tracking (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  referred_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  reward_type TEXT,
  reward_value DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(referred_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_users_subscription_tier ON auth_users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_auth_users_subscription_status ON auth_users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_auth_users_stripe_customer_id ON auth_users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_auth_users_stripe_subscription_id ON auth_users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_id ON subscription_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer_id ON referral_tracking(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_tracking_referred_id ON referral_tracking(referred_id);

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id SERIAL PRIMARY KEY,
  tier_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  yearly_price_cents INTEGER NOT NULL,
  trial_days INTEGER DEFAULT 0,
  max_receipts INTEGER,
  max_reports INTEGER,
  features JSONB NOT NULL,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_tiers (tier_name, display_name, monthly_price_cents, yearly_price_cents, trial_days, max_receipts, max_reports, features, stripe_price_id_monthly, stripe_price_id_yearly)
VALUES
  ('free', 'Free Trial', 0, 0, 7, 10, 1, '["basic_ocr", "pdf_export"]', NULL, NULL),
  ('pro', 'Pro', 999, 9999, 0, -1, -1, '["unlimited_uploads", "unlimited_reports", "custom_branding", "csv_export", "priority_processing"]', 'price_pro_monthly_999', 'price_pro_yearly_9999'),
  ('premium', 'Premium', 1499, 14999, 0, -1, -1, '["unlimited_uploads", "unlimited_reports", "custom_branding", "csv_export", "priority_processing", "email_ingestion", "team_collaboration", "analytics_dashboard", "private_cloud_archive"]', 'price_premium_monthly_1499', 'price_premium_yearly_14999')
ON CONFLICT (tier_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  trial_days = EXCLUDED.trial_days,
  max_receipts = EXCLUDED.max_receipts,
  max_reports = EXCLUDED.max_reports,
  features = EXCLUDED.features,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_price_id_yearly = EXCLUDED.stripe_price_id_yearly,
  updated_at = NOW();

-- Create function to initialize trial for new users
CREATE OR REPLACE FUNCTION initialize_user_trial(user_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE auth_users
  SET 
    subscription_tier = 'free',
    subscription_status = 'trial',
    trial_start = NOW(),
    trial_end = NOW() + INTERVAL '7 days',
    early_adopter = (SELECT COUNT(*) FROM auth_users) <= 200
  WHERE id = user_id;
  
  -- Initialize usage tracking
  INSERT INTO subscription_usage (user_id, feature, usage_count, reset_date, reset_day)
  VALUES 
    (user_id, 'receipt_uploads', 0, NOW(), CURRENT_DATE),
    (user_id, 'report_exports', 0, NOW(), CURRENT_DATE);
    
  -- Log subscription event
  INSERT INTO subscription_events (user_id, event_type, new_tier, new_status)
  VALUES (user_id, 'trial_started', 'free', 'trial');
END;
$$ LANGUAGE plpgsql;

-- Create function to check subscription limits
CREATE OR REPLACE FUNCTION check_subscription_limit(user_id INTEGER, feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  user_status TEXT;
  max_allowed INTEGER;
  current_usage INTEGER;
  tier_config RECORD;
BEGIN
  -- Get user subscription info
  SELECT subscription_tier, subscription_status INTO user_tier, user_status
  FROM auth_users WHERE id = user_id;
  
  -- Get tier configuration
  SELECT * INTO tier_config FROM subscription_tiers WHERE tier_name = user_tier;
  
  -- Check if user is in trial and expired
  IF user_status = 'trial' THEN
    IF EXISTS (SELECT 1 FROM auth_users WHERE id = user_id AND trial_end < NOW()) THEN
      -- Trial expired, downgrade to free
      UPDATE auth_users 
      SET subscription_status = 'canceled', subscription_tier = 'free'
      WHERE id = user_id;
      user_tier := 'free';
      user_status := 'canceled';
    END IF;
  END IF;
  
  -- Get current usage
  SELECT COALESCE(su.usage_count, 0) INTO current_usage
  FROM subscription_usage su
  WHERE su.user_id = user_id AND su.feature = feature AND su.reset_day = CURRENT_DATE;
  
  -- Determine max allowed based on feature
  CASE feature
    WHEN 'receipt_uploads' THEN max_allowed := tier_config.max_receipts;
    WHEN 'report_exports' THEN max_allowed := tier_config.max_reports;
    ELSE max_allowed := -1; -- Unlimited
  END CASE;
  
  -- Return true if unlimited or under limit
  RETURN max_allowed = -1 OR current_usage < max_allowed;
END;
$$ LANGUAGE plpgsql;

-- Create function to increment usage
CREATE OR REPLACE FUNCTION increment_subscription_usage(user_id INTEGER, feature TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO subscription_usage (user_id, feature, usage_count, reset_date, reset_day)
  VALUES (user_id, feature, 1, NOW(), CURRENT_DATE)
  ON CONFLICT ON CONSTRAINT subscription_usage_user_feature_day_key
  DO UPDATE SET 
    usage_count = subscription_usage.usage_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to get user subscription info
CREATE OR REPLACE FUNCTION get_user_subscription_info(user_id INTEGER)
RETURNS TABLE (
  tier TEXT,
  status TEXT,
  trial_end TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  early_adopter BOOLEAN,
  lifetime_discount DECIMAL,
  features JSONB,
  usage_receipts INTEGER,
  usage_reports INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.subscription_tier,
    u.subscription_status,
    u.trial_end,
    u.subscription_ends_at,
    u.stripe_customer_id,
    u.stripe_subscription_id,
    u.early_adopter,
    u.lifetime_discount,
    st.features,
    COALESCE(su_receipts.usage_count, 0)::INTEGER,
    COALESCE(su_reports.usage_count, 0)::INTEGER
  FROM auth_users u
  LEFT JOIN subscription_tiers st ON st.tier_name = u.subscription_tier
  LEFT JOIN subscription_usage su_receipts ON su_receipts.user_id = u.id AND su_receipts.feature = 'receipt_uploads' AND su_receipts.reset_day = CURRENT_DATE
  LEFT JOIN subscription_usage su_reports ON su_reports.user_id = u.id AND su_reports.feature = 'report_exports' AND su_reports.reset_day = CURRENT_DATE
  WHERE u.id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-initialize trial for new users
CREATE OR REPLACE FUNCTION trigger_initialize_trial()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_user_trial(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'initialize_trial_trigger'
  ) THEN
    CREATE TRIGGER initialize_trial_trigger
      AFTER INSERT ON auth_users
      FOR EACH ROW
      EXECUTE FUNCTION trigger_initialize_trial();
  END IF;
END;
$$;

-- Add comments
COMMENT ON TABLE subscription_usage IS 'Tracks daily usage limits for subscription features';
COMMENT ON TABLE subscription_events IS 'Audit trail for subscription changes and events';
COMMENT ON TABLE referral_tracking IS 'Tracks referral rewards and bonuses';
COMMENT ON TABLE subscription_tiers IS 'Configuration for subscription tiers and pricing';
COMMENT ON FUNCTION initialize_user_trial(INTEGER) IS 'Initializes 7-day trial for new users';
COMMENT ON FUNCTION check_subscription_limit(INTEGER, TEXT) IS 'Checks if user can perform action based on subscription limits';
COMMENT ON FUNCTION increment_subscription_usage(INTEGER, TEXT) IS 'Increments usage counter for a feature';
COMMENT ON FUNCTION get_user_subscription_info(INTEGER) IS 'Returns comprehensive subscription information for a user';
