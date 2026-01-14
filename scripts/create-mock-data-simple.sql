-- Mock data for testpertento.ai
-- Site ID: c_6GXisG7x0y5K96i28ww

-- Create events_raw data
DO $$
DECLARE
    v_site_id TEXT := 'c_6GXisG7x0y5K96i28ww';
    v_now TIMESTAMP := NOW();
    v_ts TIMESTAMP;
    i INTEGER;
    j INTEGER;
BEGIN
    -- Create events for last 7 days (hourly batches)
    FOR i IN 0..168 LOOP
        v_ts := v_now - (i || ' hours')::INTERVAL;
        
        -- Generate 20-50 pageviews per hour
        FOR j IN 1..(20 + (random() * 30)::INTEGER) LOOP
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, ref_domain, utm_source, utm_medium, utm_campaign, device_category, os, country)
            VALUES (
                v_site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                'vid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                'sid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                CASE ((i + j) % 6)
                    WHEN 0 THEN '/'
                    WHEN 1 THEN '/pricing'
                    WHEN 2 THEN '/features'
                    WHEN 3 THEN '/blog'
                    WHEN 4 THEN '/about'
                    ELSE '/contact'
                END,
                'inc',
                CASE WHEN random() > 0.6 THEN 'google.com' ELSE NULL END,
                CASE WHEN random() > 0.7 THEN 'google' ELSE NULL END,
                CASE WHEN random() > 0.7 THEN 'cpc' ELSE NULL END,
                CASE WHEN random() > 0.8 THEN 'summer_sale' ELSE NULL END,
                CASE ((i + j) % 3)
                    WHEN 0 THEN 'desktop'
                    WHEN 1 THEN 'mobile'
                    ELSE 'tablet'
                END,
                CASE ((i + j) % 4)
                    WHEN 0 THEN 'macOS'
                    WHEN 1 THEN 'Windows'
                    WHEN 2 THEN 'iOS'
                    ELSE 'Android'
                END,
                CASE ((i + j) % 5)
                    WHEN 0 THEN 'US'
                    WHEN 1 THEN 'GB'
                    WHEN 2 THEN 'CA'
                    WHEN 3 THEN 'DE'
                    ELSE 'FR'
                END
            );
        END LOOP;
        
        -- Generate 5-15 clicks per hour
        FOR j IN 1..(5 + (random() * 10)::INTEGER) LOOP
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, device_category, os)
            VALUES (
                v_site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                'vid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                'sid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                '/',
                'inc',
                'click:cta_signup',
                'desktop',
                'macOS'
            );
        END LOOP;
        
        -- Generate 2-8 form submits per hour
        FOR j IN 1..(2 + (random() * 6)::INTEGER) LOOP
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name)
            VALUES (
                v_site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                'vid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                'sid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                '/signup',
                'inc',
                'form_submit:signup'
            );
        END LOOP;
        
        -- Generate 1-3 purchases per hour
        IF random() > 0.3 THEN
            FOR j IN 1..(1 + (random() * 2)::INTEGER) LOOP
                INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, props, value, currency)
                VALUES (
                    v_site_id,
                    v_ts + (random() * INTERVAL '1 hour'),
                    'vid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                    'sid_' || LPAD(((i * 10 + j) % 100)::TEXT, 3, '0'),
                    '/checkout',
                    'event',
                    'purchase',
                    jsonb_build_object(
                        'order_id', 'ORD' || (i * 1000 + j),
                        'plan', CASE WHEN random() > 0.5 THEN 'pro' ELSE 'enterprise' END
                    ),
                    CASE WHEN random() > 0.5 THEN 99.00 ELSE 299.00 END,
                    'USD'
                );
            END LOOP;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Events created';
END $$;

-- Create rollup_minute data
DO $$
DECLARE
    v_site_id TEXT := 'c_6GXisG7x0y5K96i28ww';
    v_minute_ts TIMESTAMP;
    i INTEGER;
    v_paths TEXT[] := ARRAY['/', '/pricing', '/features', '/blog', '/about', '/contact'];
    v_path TEXT;
BEGIN
    -- Create rollups for last 7 days (every 5 minutes to reduce data)
    FOR i IN 0..2016 LOOP -- 7 days * 24 hours * 12 (every 5 minutes)
        v_minute_ts := DATE_TRUNC('minute', NOW() - (i * 5 || ' minutes')::INTERVAL);
        
        FOREACH v_path IN ARRAY v_paths LOOP
            -- Pageviews
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, os, country, ref_domain, utm_source, utm_medium, utm_campaign, count)
            VALUES (
                v_site_id,
                v_minute_ts,
                v_path,
                'pv',
                'desktop',
                'macOS',
                'US',
                '',
                '',
                '',
                '',
                5 + (random() * 20)::INTEGER
            )
            ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
            DO UPDATE SET count = rollup_minute.count + EXCLUDED.count;
            
            -- Clicks (occasionally)
            IF random() > 0.7 THEN
                INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, os, country, ref_domain, utm_source, utm_medium, utm_campaign, count)
                VALUES (
                    v_site_id,
                    v_minute_ts,
                    v_path,
                    'click:cta_signup',
                    'desktop',
                    'macOS',
                    'US',
                    '',
                    '',
                    '',
                    '',
                    1 + (random() * 3)::INTEGER
                )
                ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
                DO UPDATE SET count = rollup_minute.count + EXCLUDED.count;
            END IF;
        END LOOP;
        
        -- Form submits
        IF random() > 0.8 THEN
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, os, country, ref_domain, utm_source, utm_medium, utm_campaign, count)
            VALUES (
                v_site_id,
                v_minute_ts,
                '/signup',
                'form_submit:signup',
                'desktop',
                'macOS',
                'US',
                '',
                '',
                '',
                '',
                1 + (random() * 2)::INTEGER
            )
            ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
            DO UPDATE SET count = rollup_minute.count + EXCLUDED.count;
        END IF;
        
        -- Purchases
        IF random() > 0.9 THEN
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, os, country, ref_domain, utm_source, utm_medium, utm_campaign, count, value_sum)
            VALUES (
                v_site_id,
                v_minute_ts,
                '/checkout',
                'custom:purchase',
                'desktop',
                'macOS',
                'US',
                '',
                '',
                '',
                '',
                1,
                99.00 + (random() * 200)::NUMERIC
            )
            ON CONFLICT (site_id, minute_ts, path, event_key, country, device_category, os, ref_domain, utm_source, utm_medium, utm_campaign)
            DO UPDATE SET 
                count = rollup_minute.count + EXCLUDED.count,
                value_sum = COALESCE(rollup_minute.value_sum, 0) + EXCLUDED.value_sum;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Rollups created';
END $$;

-- Create event definitions
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

-- Create cardinality data
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

