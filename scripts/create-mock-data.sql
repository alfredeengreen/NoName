-- Mock data for testpertento.ai
-- Site ID: c_6GXisG7x0y5K96i28ww

-- Generate some visitor and session IDs
DO $$
DECLARE
    site_id TEXT := 'c_6GXisG7x0y5K96i28ww';
    vid1 TEXT := 'visitor_001';
    vid2 TEXT := 'visitor_002';
    vid3 TEXT := 'visitor_003';
    sid1 TEXT := 'session_001';
    sid2 TEXT := 'session_002';
    sid3 TEXT := 'session_003';
    sid4 TEXT := 'session_004';
    now_ts TIMESTAMP := NOW();
    event_ts TIMESTAMP;
    i INTEGER;
BEGIN
    -- Create events for the last 7 days
    FOR i IN 0..168 LOOP
        event_ts := now_ts - (i || ' hours')::INTERVAL;
        
        -- Visitor 1 - Multiple sessions
        IF i % 24 < 8 THEN
            -- Session 1: Homepage -> Pricing -> Signup
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, ref_domain, utm_source, utm_medium, utm_campaign, device_category, os, country)
            VALUES 
            (site_id, event_ts - INTERVAL '5 minutes', vid1, sid1, '/', 'inc', NULL, 'google.com', 'google', 'cpc', 'summer_sale', 'desktop', 'macOS', 'US'),
            (site_id, event_ts - INTERVAL '4 minutes', vid1, sid1, '/pricing', 'inc', NULL, NULL, 'google', 'cpc', 'summer_sale', 'desktop', 'macOS', 'US'),
            (site_id, event_ts - INTERVAL '3 minutes', vid1, sid1, '/pricing', 'inc', NULL, NULL, 'google', 'cpc', 'summer_sale', 'desktop', 'macOS', 'US'),
            (site_id, event_ts - INTERVAL '2 minutes', vid1, sid1, '/signup', 'inc', NULL, NULL, 'google', 'cpc', 'summer_sale', 'desktop', 'macOS', 'US'),
            (site_id, event_ts - INTERVAL '1 minute', vid1, sid1, '/signup', 'event', 'signup_started', NULL, 'google', 'cpc', 'summer_sale', 'desktop', 'macOS', 'US');
        END IF;
        
        -- Visitor 2 - Blog reader
        IF i % 12 = 0 THEN
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, ref_domain, utm_source, utm_medium, utm_campaign, device_category, os, country)
            VALUES 
            (site_id, event_ts, vid2, sid2, '/blog', 'inc', NULL, 'twitter.com', 'twitter', 'social', NULL, 'mobile', 'iOS', 'US'),
            (site_id, event_ts + INTERVAL '30 seconds', vid2, sid2, '/blog/post-1', 'inc', NULL, NULL, 'twitter', 'social', NULL, 'mobile', 'iOS', 'US'),
            (site_id, event_ts + INTERVAL '1 minute', vid2, sid2, '/blog/post-1', 'inc', NULL, NULL, 'twitter', 'social', NULL, 'mobile', 'iOS', 'US');
        END IF;
        
        -- Visitor 3 - Direct traffic, form submissions
        IF i % 36 = 0 THEN
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, ref_domain, device_category, os, country)
            VALUES 
            (site_id, event_ts, vid3, sid3, '/', 'inc', NULL, NULL, 'desktop', 'Windows', 'GB'),
            (site_id, event_ts + INTERVAL '2 minutes', vid3, sid3, '/contact', 'inc', NULL, NULL, 'desktop', 'Windows', 'GB'),
            (site_id, event_ts + INTERVAL '3 minutes', vid3, sid3, '/contact', 'inc', NULL, NULL, 'desktop', 'Windows', 'GB'),
            (site_id, event_ts + INTERVAL '4 minutes', vid3, sid3, '/contact', 'event', 'form_submit:contact', NULL, 'desktop', 'Windows', 'GB');
        END IF;
    END LOOP;
    
    -- Add some recent high-activity events
    FOR i IN 0..23 LOOP
        event_ts := now_ts - (i || ' hours')::INTERVAL;
        
        -- Pageviews
        INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, ref_domain, device_category, os, country)
        SELECT 
            site_id,
            event_ts + (random() * INTERVAL '1 hour'),
            'vid_' || LPAD((i % 10 + 1)::TEXT, 3, '0'),
            'sid_' || LPAD((i % 10 + 1)::TEXT, 3, '0'),
            CASE (i % 5)
                WHEN 0 THEN '/'
                WHEN 1 THEN '/pricing'
                WHEN 2 THEN '/features'
                WHEN 3 THEN '/blog'
                ELSE '/about'
            END,
            'inc',
            CASE WHEN random() > 0.5 THEN 'google.com' ELSE NULL END,
            CASE (i % 3)
                WHEN 0 THEN 'desktop'
                WHEN 1 THEN 'mobile'
                ELSE 'tablet'
            END,
            CASE (i % 4)
                WHEN 0 THEN 'macOS'
                WHEN 1 THEN 'Windows'
                WHEN 2 THEN 'iOS'
                ELSE 'Android'
            END,
            CASE (i % 3)
                WHEN 0 THEN 'US'
                WHEN 1 THEN 'GB'
                ELSE 'CA'
            END
        FROM generate_series(1, 10 + (i % 20));
        
        -- Clicks
        INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, device_category, os)
        SELECT 
            site_id,
            event_ts + (random() * INTERVAL '1 hour'),
            'vid_' || LPAD((i % 10 + 1)::TEXT, 3, '0'),
            'sid_' || LPAD((i % 10 + 1)::TEXT, 3, '0'),
            '/',
            'inc',
            'click:cta_signup',
            'desktop',
            'macOS'
        FROM generate_series(1, 5 + (i % 10));
        
        -- Form submits
        INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name)
        SELECT 
            site_id,
            event_ts + (random() * INTERVAL '1 hour'),
            'vid_' || LPAD((i % 10 + 1)::TEXT, 3, '0'),
            'sid_' || LPAD((i % 10 + 1)::TEXT, 3, '0'),
            '/signup',
            'inc',
            'form_submit:signup'
        FROM generate_series(1, 3 + (i % 5));
        
        -- Custom events
        INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, props, value, currency)
        VALUES 
        (site_id, event_ts + INTERVAL '10 minutes', 'vid_001', 'sid_001', '/checkout', 'event', 'purchase', '{"order_id": "ORD' || i || '", "plan": "pro"}'::jsonb, 99.00, 'USD'),
        (site_id, event_ts + INTERVAL '15 minutes', 'vid_002', 'sid_002', '/checkout', 'event', 'purchase', '{"order_id": "ORD' || (i + 100) || '", "plan": "enterprise"}'::jsonb, 299.00, 'USD'),
        (site_id, event_ts + INTERVAL '20 minutes', 'vid_003', 'sid_003', '/dashboard', 'event', 'trial_started', '{"plan": "pro"}'::jsonb, NULL, NULL);
    END LOOP;
    
    RAISE NOTICE 'Mock events created';
END $$;

-- Create rollup_minute data for last 7 days
DO $$
DECLARE
    site_id TEXT := 'c_6GXisG7x0y5K96i28ww';
    minute_ts TIMESTAMP;
    i INTEGER;
BEGIN
    FOR i IN 0..10080 LOOP -- 7 days * 24 hours * 60 minutes
        minute_ts := DATE_TRUNC('minute', NOW() - (i || ' minutes')::INTERVAL);
        
        -- Pageviews
        INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, os, country, count)
        VALUES 
        (site_id, minute_ts, '/', 'pv', 'desktop', 'macOS', 'US', 10 + (random() * 50)::INTEGER),
        (site_id, minute_ts, '/pricing', 'pv', 'desktop', 'Windows', 'US', 5 + (random() * 20)::INTEGER),
        (site_id, minute_ts, '/blog', 'pv', 'mobile', 'iOS', 'US', 3 + (random() * 15)::INTEGER)
        ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
        DO UPDATE SET count = rollup_minute.count + EXCLUDED.count;
        
        -- Clicks
        IF random() > 0.7 THEN
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, count)
            VALUES 
            (site_id, minute_ts, '/', 'click:cta_signup', 'desktop', 2 + (random() * 5)::INTEGER)
            ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
            DO UPDATE SET count = rollup_minute.count + EXCLUDED.count;
        END IF;
        
        -- Form submits
        IF random() > 0.8 THEN
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, count)
            VALUES 
            (site_id, minute_ts, '/signup', 'form_submit:signup', 1 + (random() * 3)::INTEGER)
            ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
            DO UPDATE SET count = rollup_minute.count + EXCLUDED.count;
        END IF;
        
        -- Custom events
        IF random() > 0.9 THEN
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, count, value_sum)
            VALUES 
            (site_id, minute_ts, '/checkout', 'custom:purchase', 1, 99.00 + (random() * 200)::NUMERIC)
            ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
            DO UPDATE SET 
                count = rollup_minute.count + EXCLUDED.count,
                value_sum = COALESCE(rollup_minute.value_sum, 0) + EXCLUDED.value_sum;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Rollup data created';
END $$;

-- Create ingest_stats for last 7 days
DO $$
DECLARE
    v_site_id TEXT := 'c_6GXisG7x0y5K96i28ww';
    v_minute_ts TIMESTAMP;
    i INTEGER;
BEGIN
    FOR i IN 0..10080 LOOP
        v_minute_ts := DATE_TRUNC('minute', NOW() - (i || ' minutes')::INTERVAL);
        
        INSERT INTO ingest_stats (site_id, minute_ts, accepted_count, dropped_invalid, dropped_pii, dropped_rate_limited, dropped_cardinality, last_event_ts)
        VALUES 
        (
            v_site_id,
            v_minute_ts,
            50 + (random() * 200)::INTEGER, -- accepted
            (random() * 5)::INTEGER, -- dropped invalid
            (random() * 2)::INTEGER, -- dropped PII
            0, -- dropped rate limited
            CASE WHEN random() > 0.95 THEN (random() * 3)::INTEGER ELSE 0 END, -- dropped cardinality
            v_minute_ts + INTERVAL '30 seconds'
        )
        ON CONFLICT (site_id, minute_ts)
        DO UPDATE SET
            accepted_count = ingest_stats.accepted_count + EXCLUDED.accepted_count,
            dropped_invalid = ingest_stats.dropped_invalid + EXCLUDED.dropped_invalid,
            dropped_pii = ingest_stats.dropped_pii + EXCLUDED.dropped_pii,
            dropped_cardinality = ingest_stats.dropped_cardinality + EXCLUDED.dropped_cardinality,
            last_event_ts = GREATEST(ingest_stats.last_event_ts, EXCLUDED.last_event_ts);
    END LOOP;
    
    RAISE NOTICE 'Ingest stats created';
END $$;

-- Create event definitions for custom events
INSERT INTO event_defs (id, site_id, event_name, enabled, props_allowlist, value_rule, updated_at)
VALUES 
('evt_001', 'c_6GXisG7x0y5K96i28ww', 'purchase', true, 
 '[{"key": "order_id", "type": "string", "mode": "dimension"}, {"key": "plan", "type": "string", "mode": "dimension"}, {"key": "value", "type": "number", "mode": "metric"}]'::jsonb,
 '{"mode": "prop", "prop_key": "value"}'::jsonb,
 NOW()),
('evt_002', 'c_6GXisG7x0y5K96i28ww', 'signup_started', true,
 '[{"key": "plan", "type": "string", "mode": "dimension"}]'::jsonb,
 '{"mode": "none"}'::jsonb,
 NOW()),
('evt_003', 'c_6GXisG7x0y5K96i28ww', 'trial_started', true,
 '[{"key": "plan", "type": "string", "mode": "dimension"}]'::jsonb,
 '{"mode": "none"}'::jsonb,
 NOW())
ON CONFLICT (site_id, event_name) DO NOTHING;

-- Create some cardinality data
INSERT INTO dim_cardinality (site_id, day, dimension, value_hash)
SELECT 
    'c_6GXisG7x0y5K96i28ww',
    CURRENT_DATE - (i || ' days')::INTERVAL,
    'path',
    MD5('/page_' || i)
FROM generate_series(0, 6) i
ON CONFLICT DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE 'Mock data creation complete for testpertento.ai';
END $$;

