-- Comprehensive Mock Data for All Reports
-- Site ID: c_6GXisG7x0y5K96i28ww
-- This script generates realistic data for all analytics reports

DO $$
DECLARE
    site_id TEXT := 'c_6GXisG7x0y5K96i28ww';
    v_now TIMESTAMP := NOW();
    v_ts TIMESTAMP;
    v_vid TEXT;
    v_sid TEXT;
    i INTEGER;
    j INTEGER;
    k INTEGER;
    error_id_val TEXT;
    error_fingerprint TEXT;
    v_paths TEXT[] := ARRAY['/', '/pricing', '/features', '/blog', '/about', '/contact', '/signup', '/checkout', '/dashboard', '/blog/post-1', '/blog/post-2', '/blog/post-3', '/pricing/pro', '/pricing/enterprise'];
    v_path TEXT;
    v_devices TEXT[] := ARRAY['desktop', 'mobile', 'tablet'];
    v_os TEXT[] := ARRAY['macOS', 'Windows', 'iOS', 'Android', 'Linux'];
    v_countries TEXT[] := ARRAY['US', 'GB', 'CA', 'DE', 'FR', 'AU', 'JP', 'BR', 'IN', 'NL'];
    v_browsers TEXT[] := ARRAY['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera'];
    v_utm_sources TEXT[] := ARRAY['google', 'facebook', 'twitter', 'linkedin', 'email', 'direct'];
    v_utm_mediums TEXT[] := ARRAY['cpc', 'organic', 'social', 'email', 'referral'];
    v_utm_campaigns TEXT[] := ARRAY['summer_sale', 'winter_promo', 'product_launch', 'blog_campaign', NULL];
    v_ref_domains TEXT[] := ARRAY['google.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'reddit.com', NULL];
    v_event_names TEXT[] := ARRAY['purchase', 'signup_started', 'trial_started', 'upgrade_clicked', 'download_started', 'video_played', 'newsletter_signup'];
    v_error_types TEXT[] := ARRAY['js', 'network', 'resource', 'promise'];
    v_error_messages TEXT[] := ARRAY['TypeError: Cannot read property', 'Network request failed', 'Failed to load resource', 'Uncaught Promise rejection'];
BEGIN
    RAISE NOTICE 'Starting comprehensive mock data generation...';
    
    -- ============================================
    -- 1. EVENTS_RAW - Main events table
    -- ============================================
    RAISE NOTICE 'Generating events_raw data...';
    
    -- Generate events for last 30 days (more comprehensive)
    FOR i IN 0..720 LOOP -- 30 days * 24 hours
        v_ts := v_now - (i || ' hours')::INTERVAL;
        
        -- Generate 50-200 pageviews per hour
        FOR j IN 1..(50 + (random() * 150)::INTEGER) LOOP
            v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
            v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
            v_path := v_paths[1 + ((i + j) % array_length(v_paths, 1))];
            
            INSERT INTO events_raw (
                site_id, ts, vid, sid, path, event_type, event_name,
                ref_domain, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                country, device_category, os, sw, sh, dpr,
                props, value, currency
            ) VALUES (
                site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                v_vid,
                v_sid,
                v_path,
                'inc',
                NULL,
                CASE WHEN random() > 0.4 THEN v_ref_domains[1 + ((i + j) % array_length(v_ref_domains, 1))] ELSE NULL END,
                CASE WHEN random() > 0.5 THEN v_utm_sources[1 + ((i + j) % array_length(v_utm_sources, 1))] ELSE NULL END,
                CASE WHEN random() > 0.5 THEN v_utm_mediums[1 + ((i + j) % array_length(v_utm_mediums, 1))] ELSE NULL END,
                CASE WHEN random() > 0.6 THEN v_utm_campaigns[1 + ((i + j) % array_length(v_utm_campaigns, 1))] ELSE NULL END,
                CASE WHEN random() > 0.7 THEN 'banner_' || (j % 5) ELSE NULL END,
                CASE WHEN random() > 0.7 THEN 'keyword_' || (j % 10) ELSE NULL END,
                v_countries[1 + ((i + j) % array_length(v_countries, 1))],
                v_devices[1 + ((i + j) % array_length(v_devices, 1))],
                v_os[1 + ((i + j) % array_length(v_os, 1))],
                1920 + (random() * 1000)::INTEGER,
                1080 + (random() * 500)::INTEGER,
                1.0 + (random() * 2.0)::NUMERIC,
                jsonb_build_object(
                    'page_title', 'Page ' || v_path,
                    'user_type', CASE WHEN random() > 0.7 THEN 'premium' ELSE 'free' END
                ),
                NULL,
                NULL
            );
        END LOOP;
        
        -- Generate click events (10-30 per hour)
        FOR j IN 1..(10 + (random() * 20)::INTEGER) LOOP
            v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
            v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
            
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, device_category, os)
            VALUES (
                site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                v_vid,
                v_sid,
                '/',
                'inc',
                'click:cta_signup',
                'desktop',
                'macOS'
            );
        END LOOP;
        
        -- Generate form submits (5-15 per hour)
        FOR j IN 1..(5 + (random() * 10)::INTEGER) LOOP
            v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
            v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
            
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, props)
            VALUES (
                site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                v_vid,
                v_sid,
                '/signup',
                'inc',
                'form_submit:signup',
                jsonb_build_object('form_id', 'signup_form', 'plan', CASE WHEN random() > 0.5 THEN 'pro' ELSE 'enterprise' END)
            );
        END LOOP;
        
        -- Generate custom events (3-10 per hour)
        FOR j IN 1..(3 + (random() * 7)::INTEGER) LOOP
            v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
            v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
            v_path := v_paths[1 + ((i + j) % array_length(v_paths, 1))];
            
            INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, props, value, currency)
            VALUES (
                site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                v_vid,
                v_sid,
                v_path,
                'event',
                v_event_names[1 + ((i + j) % array_length(v_event_names, 1))],
                jsonb_build_object(
                    'order_id', 'ORD' || (i * 1000 + j),
                    'plan', CASE WHEN random() > 0.5 THEN 'pro' ELSE 'enterprise' END,
                    'category', CASE (j % 3) WHEN 0 THEN 'subscription' WHEN 1 THEN 'one-time' ELSE 'trial' END
                ),
                CASE 
                    WHEN random() > 0.7 THEN 99.00 + (random() * 200)::NUMERIC
                    ELSE NULL
                END,
                CASE WHEN random() > 0.7 THEN 'USD' ELSE NULL END
            );
        END LOOP;
        
        -- Generate purchase events (1-5 per hour)
        IF random() > 0.2 THEN
            FOR j IN 1..(1 + (random() * 4)::INTEGER) LOOP
                v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
                v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
                
                INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, props, value, currency)
                VALUES (
                    site_id,
                    v_ts + (random() * INTERVAL '1 hour'),
                    v_vid,
                    v_sid,
                    '/checkout',
                    'event',
                    'purchase',
                    jsonb_build_object(
                        'order_id', 'ORD' || (i * 10000 + j),
                        'plan', CASE WHEN random() > 0.5 THEN 'pro' ELSE 'enterprise' END,
                        'items', (random() * 5 + 1)::INTEGER
                    ),
                    99.00 + (random() * 200)::NUMERIC,
                    'USD'
                );
            END LOOP;
        END IF;
        
        -- Generate error events (occasionally)
        IF random() > 0.85 THEN
            FOR j IN 1..(1 + (random() * 3)::INTEGER) LOOP
                v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
                v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
                
                INSERT INTO events_raw (site_id, ts, vid, sid, path, event_type, event_name, props)
                VALUES (
                    site_id,
                    v_ts + (random() * INTERVAL '1 hour'),
                    v_vid,
                    v_sid,
                    v_paths[1 + ((i + j) % array_length(v_paths, 1))],
                    'event',
                    'error',
                    jsonb_build_object(
                        'error_type', v_error_types[1 + ((i + j) % array_length(v_error_types, 1))],
                        'error_message', v_error_messages[1 + ((i + j) % array_length(v_error_messages, 1))]
                    )
                );
            END LOOP;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'events_raw data generated';
    
    -- ============================================
    -- 2. ECOMMERCE_ITEMS
    -- ============================================
    RAISE NOTICE 'Generating ecommerce_items data...';
    
    INSERT INTO ecommerce_items (event_id, site_id, item_id, item_name, item_category, item_brand, quantity, price, revenue)
    SELECT 
        er.id,
        site_id,
        'item_' || (er.id % 100),
        CASE (er.id % 5)
            WHEN 0 THEN 'Premium Plan'
            WHEN 1 THEN 'Enterprise Plan'
            WHEN 2 THEN 'Add-on Feature'
            WHEN 3 THEN 'Support Package'
            ELSE 'Custom Integration'
        END,
        CASE WHEN random() > 0.5 THEN 'subscription' ELSE 'one-time' END,
        'No Name Analytics',
        (random() * 3 + 1)::INTEGER,
        50.00 + (random() * 250)::NUMERIC,
        (50.00 + (random() * 250)::NUMERIC) * (random() * 3 + 1)::INTEGER
    FROM events_raw er
    WHERE er.site_id = site_id
        AND er.event_name = 'purchase'
        AND er.event_type = 'event'
    LIMIT 500;
    
    RAISE NOTICE 'ecommerce_items data generated';
    
    -- ============================================
    -- 3. ROLLUP_MINUTE - Aggregated data
    -- ============================================
    RAISE NOTICE 'Generating rollup_minute data...';
    
    FOR i IN 0..4320 LOOP -- 30 days * 24 hours * 6 (every 10 minutes)
        v_ts := DATE_TRUNC('minute', v_now - (i * 10 || ' minutes')::INTERVAL);
        
        FOREACH v_path IN ARRAY v_paths LOOP
            -- Pageviews
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, os, country, ref_domain, utm_source, utm_medium, utm_campaign, count)
            VALUES (
                site_id,
                v_ts,
                v_path,
                'pv',
                v_devices[1 + (i % array_length(v_devices, 1))],
                v_os[1 + (i % array_length(v_os, 1))],
                v_countries[1 + (i % array_length(v_countries, 1))],
                COALESCE(v_ref_domains[1 + (i % array_length(v_ref_domains, 1))], ''),
                COALESCE(v_utm_sources[1 + (i % array_length(v_utm_sources, 1))], ''),
                COALESCE(v_utm_mediums[1 + (i % array_length(v_utm_mediums, 1))], ''),
                COALESCE(v_utm_campaigns[1 + (i % array_length(v_utm_campaigns, 1))], ''),
                10 + (random() * 50)::INTEGER
            )
            ON CONFLICT DO NOTHING;
            
            -- Clicks
            IF random() > 0.7 THEN
                INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, device_category, os, country, ref_domain, utm_source, utm_medium, utm_campaign, count)
                VALUES (
                    site_id,
                    v_ts,
                    v_path,
                    'click:cta_signup',
                    'desktop',
                    'macOS',
                    'US',
                    '',
                    '',
                    '',
                    '',
                    1 + (random() * 5)::INTEGER
                )
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
        
        -- Form submits
        IF random() > 0.8 THEN
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, count)
            VALUES (
                site_id,
                v_ts,
                '/signup',
                'form_submit:signup',
                1 + (random() * 3)::INTEGER
            )
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Purchases
        IF random() > 0.9 THEN
            INSERT INTO rollup_minute (site_id, minute_ts, path, event_key, count, value_sum)
            VALUES (
                site_id,
                v_ts,
                '/checkout',
                'custom:purchase',
                1,
                99.00 + (random() * 200)::NUMERIC
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'rollup_minute data generated';
    
    -- ============================================
    -- 4. ERRORS and ERROR_EVENTS
    -- ============================================
    RAISE NOTICE 'Generating errors and error_events data...';
    
    FOR i IN 1..50 LOOP
        v_ts := v_now - ((i * 12) || ' hours')::INTERVAL;
        error_id_val := 'err_' || LPAD(i::TEXT, 6, '0');
        error_fingerprint := MD5('error_' || i);
        
        INSERT INTO errors (
            id, site_id, fingerprint, type, message, url, environment, release, first_seen, last_seen, count
        )
        VALUES (
            error_id_val,
            site_id,
            error_fingerprint,
            v_error_types[1 + (i % array_length(v_error_types, 1))],
            v_error_messages[1 + (i % array_length(v_error_messages, 1))] || ' ' || i,
            v_paths[1 + (i % array_length(v_paths, 1))],
            'production',
            '1.0.' || i,
            v_ts,
            v_ts + (random() * INTERVAL '2 hours'),
            (random() * 100 + 1)::INTEGER
        )
        ON CONFLICT (site_id, fingerprint) DO UPDATE SET
            last_seen = EXCLUDED.last_seen,
            count = errors.count + 1;
        
        -- Generate error events for this error
        FOR j IN 1..(random() * 20 + 1)::INTEGER LOOP
            v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
            v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
            
            INSERT INTO error_events (error_id, site_id, vid, sid, path, ts, user_agent, props)
            VALUES (
                error_id_val,
                site_id,
                v_vid,
                v_sid,
                v_paths[1 + ((i + j) % array_length(v_paths, 1))],
                v_ts + (random() * INTERVAL '2 hours'),
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                jsonb_build_object('user_id', 'user_' || j, 'plan', CASE WHEN random() > 0.5 THEN 'pro' ELSE 'free' END)
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'errors and error_events data generated';
    
    -- ============================================
    -- 5. PERFORMANCE_METRICS
    -- ============================================
    RAISE NOTICE 'Generating performance_metrics data...';
    
    FOR i IN 0..720 LOOP -- 30 days * 24 hours
        v_ts := v_now - (i || ' hours')::INTERVAL;
        
        -- API calls
        FOR j IN 1..(10 + (random() * 40)::INTEGER) LOOP
            INSERT INTO performance_metrics (site_id, ts, type, name, duration, status, size, props)
            VALUES (
                site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                'api',
                '/api/data',
                50 + (random() * 500)::INTEGER,
                200,
                1000 + (random() * 5000)::INTEGER,
                jsonb_build_object('vid', 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0'), 'sid', 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0'))
            );
        END LOOP;
        
        -- Resource loads
        FOR j IN 1..(20 + (random() * 80)::INTEGER) LOOP
            INSERT INTO performance_metrics (site_id, ts, type, name, duration, status, size, props)
            VALUES (
                site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                'resource',
                '/static/js/app.' || (j % 10) || '.js',
                10 + (random() * 200)::INTEGER,
                200,
                50000 + (random() * 200000)::INTEGER,
                jsonb_build_object('vid', 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0'), 'sid', 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0'))
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'performance_metrics data generated';
    
    -- ============================================
    -- 6. HEATMAP_DATA
    -- ============================================
    RAISE NOTICE 'Generating heatmap_data...';
    
    FOR i IN 0..720 LOOP -- 30 days * 24 hours
        v_ts := v_now - (i || ' hours')::INTERVAL;
        v_path := v_paths[1 + (i % array_length(v_paths, 1))];
        
        -- Generate click heatmap data
        FOR j IN 1..(5 + (random() * 20)::INTEGER) LOOP
            INSERT INTO heatmap_data (site_id, path, type, x, y, intensity, device_category, ts)
            VALUES (
                site_id,
                v_path,
                'click',
                (random() * 1000)::INTEGER,
                (random() * 1000)::INTEGER,
                1 + (random() * 10)::INTEGER,
                v_devices[1 + (j % array_length(v_devices, 1))],
                v_ts + (random() * INTERVAL '1 hour')
            );
        END LOOP;
        
        -- Generate scroll heatmap data
        FOR j IN 1..(10 + (random() * 30)::INTEGER) LOOP
            INSERT INTO heatmap_data (site_id, path, type, x, y, intensity, device_category, ts)
            VALUES (
                site_id,
                v_path,
                'scroll',
                0,
                (random() * 1000)::INTEGER,
                1 + (random() * 5)::INTEGER,
                v_devices[1 + (j % array_length(v_devices, 1))],
                v_ts + (random() * INTERVAL '1 hour')
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'heatmap_data generated';
    
    -- ============================================
    -- 7. FORM_ANALYTICS
    -- ============================================
    RAISE NOTICE 'Generating form_analytics data...';
    
    FOR i IN 0..720 LOOP
        v_ts := v_now - (i || ' hours')::INTERVAL;
        
        FOR j IN 1..(3 + (random() * 10)::INTEGER) LOOP
            v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
            v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
            
            -- Form focus events
            INSERT INTO form_analytics (site_id, ts, form_id, field_name, event_type, sid, time_spent, error_count, props)
            VALUES (
                site_id,
                v_ts + (random() * INTERVAL '1 hour'),
                'signup_form',
                'email',
                'focus',
                v_sid,
                NULL,
                0,
                jsonb_build_object('vid', v_vid)
            );
            
            -- Form submit events
            IF random() > 0.7 THEN
                INSERT INTO form_analytics (site_id, ts, form_id, field_name, event_type, sid, time_spent, error_count, props)
                VALUES (
                    site_id,
                    v_ts + (random() * INTERVAL '1 hour') + INTERVAL '2 minutes',
                    'signup_form',
                    NULL,
                    'submit',
                    v_sid,
                    120,
                    CASE WHEN random() > 0.8 THEN (random() * 3)::INTEGER ELSE 0 END,
                    jsonb_build_object('vid', v_vid)
                );
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'form_analytics data generated';
    
    -- ============================================
    -- 8. SESSION_RECORDINGS
    -- ============================================
    RAISE NOTICE 'Generating session_recordings data...';
    
    FOR i IN 1..200 LOOP
        v_vid := 'vid_' || LPAD((i % 5000)::TEXT, 4, '0');
        v_sid := 'sid_' || LPAD((i % 10000)::TEXT, 4, '0');
        v_ts := v_now - ((i * 2) || ' hours')::INTERVAL;
        v_path := v_paths[1 + (i % array_length(v_paths, 1))];
        
        INSERT INTO session_recordings (id, site_id, vid, sid, path, start_time, end_time, duration, events, snapshots, metadata)
        VALUES (
            'rec_' || LPAD(i::TEXT, 6, '0'),
            site_id,
            v_vid,
            v_sid,
            v_path,
            v_ts,
            v_ts + INTERVAL '5 minutes',
            300,
            jsonb_build_array(
                jsonb_build_object('type', 'pageview', 'timestamp', EXTRACT(EPOCH FROM v_ts), 'data', jsonb_build_object('url', v_path)),
                jsonb_build_object('type', 'click', 'timestamp', EXTRACT(EPOCH FROM v_ts) + 1000, 'data', jsonb_build_object('target', 'button'))
            ),
            jsonb_build_array(
                jsonb_build_object('timestamp', EXTRACT(EPOCH FROM v_ts), 'html', '<html>...</html>', 'width', 1920, 'height', 1080)
            ),
            jsonb_build_object(
                'device', jsonb_build_object('category', v_devices[1 + (i % array_length(v_devices, 1))], 'os', v_os[1 + (i % array_length(v_os, 1))]),
                'viewport', jsonb_build_object('width', 1920, 'height', 1080),
                'url', v_path
            )
        );
    END LOOP;
    
    RAISE NOTICE 'session_recordings data generated';
    
    -- ============================================
    -- 9. GOALS
    -- ============================================
    RAISE NOTICE 'Creating goals...';
    
    INSERT INTO goals (id, site_id, name, type, config, description, enabled, created_at, updated_at)
    VALUES
    ('goal_001', site_id, 'Signup Completed', 'event', 
     jsonb_build_object('event_name', 'form_submit:signup'), 
     'User completes signup form', true, NOW(), NOW()),
    ('goal_002', site_id, 'Purchase Made', 'event',
     jsonb_build_object('event_name', 'purchase', 'value_threshold', 50),
     'User makes a purchase', true, NOW(), NOW()),
    ('goal_003', site_id, 'Pricing Page Visit', 'destination',
     jsonb_build_object('path', '/pricing'),
     'User visits pricing page', true, NOW(), NOW()),
    ('goal_004', site_id, '5+ Page Views', 'pages_per_session',
     jsonb_build_object('pages', 5),
     'User views 5 or more pages', true, NOW(), NOW())
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'goals created';
    
    -- ============================================
    -- 10. CAMPAIGNS
    -- ============================================
    RAISE NOTICE 'Creating campaigns...';
    
    INSERT INTO campaigns (id, site_id, name, utm_source, utm_medium, utm_campaign, cost, budget, start_date, end_date, description, created_at, updated_at)
    VALUES
    ('camp_001', site_id, 'Summer Sale 2024', 'google', 'cpc', 'summer_sale', 5000.00, 10000.00, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days', 'Summer promotion campaign', NOW(), NOW()),
    ('camp_002', site_id, 'Product Launch', 'facebook', 'social', 'product_launch', 3000.00, 5000.00, CURRENT_DATE - INTERVAL '15 days', CURRENT_DATE + INTERVAL '15 days', 'New product launch campaign', NOW(), NOW()),
    ('camp_003', site_id, 'Blog Content Campaign', 'twitter', 'social', 'blog_campaign', 1000.00, 2000.00, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days', 'Blog content promotion', NOW(), NOW())
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'campaigns created';
    
    -- ============================================
    -- 11. INGEST_STATS
    -- ============================================
    RAISE NOTICE 'Generating ingest_stats data...';
    
    FOR i IN 0..4320 LOOP -- 30 days * 24 hours * 6 (every 10 minutes)
        v_ts := DATE_TRUNC('minute', v_now - (i * 10 || ' minutes')::INTERVAL);
        
        INSERT INTO ingest_stats (site_id, minute_ts, accepted_count, dropped_invalid, dropped_pii, dropped_rate_limited, dropped_cardinality, last_event_ts)
        VALUES (
            site_id,
            v_ts,
            100 + (random() * 400)::INTEGER,
            (random() * 5)::INTEGER,
            (random() * 2)::INTEGER,
            0,
            CASE WHEN random() > 0.95 THEN (random() * 3)::INTEGER ELSE 0 END,
            v_ts + INTERVAL '30 seconds'
        )
        ON CONFLICT (site_id, minute_ts)
        DO UPDATE SET
            accepted_count = ingest_stats.accepted_count + EXCLUDED.accepted_count,
            dropped_invalid = ingest_stats.dropped_invalid + EXCLUDED.dropped_invalid,
            dropped_pii = ingest_stats.dropped_pii + EXCLUDED.dropped_pii,
            dropped_cardinality = ingest_stats.dropped_cardinality + EXCLUDED.dropped_cardinality,
            last_event_ts = GREATEST(ingest_stats.last_event_ts, EXCLUDED.last_event_ts);
    END LOOP;
    
    RAISE NOTICE 'ingest_stats data generated';
    
    -- ============================================
    -- 12. EVENT_DEFS
    -- ============================================
    RAISE NOTICE 'Creating event definitions...';
    
    INSERT INTO event_defs (id, site_id, event_name, enabled, props_allowlist, value_rule, updated_at)
    VALUES
    ('evt_001', site_id, 'purchase', true,
     '[{"key": "order_id", "type": "string", "mode": "dimension"}, {"key": "plan", "type": "string", "mode": "dimension"}, {"key": "value", "type": "number", "mode": "metric"}]'::jsonb,
     '{"mode": "prop", "prop_key": "value"}'::jsonb,
     NOW()),
    ('evt_002', site_id, 'signup_started', true,
     '[{"key": "plan", "type": "string", "mode": "dimension"}]'::jsonb,
     '{"mode": "none"}'::jsonb,
     NOW()),
    ('evt_003', site_id, 'trial_started', true,
     '[{"key": "plan", "type": "string", "mode": "dimension"}]'::jsonb,
     '{"mode": "none"}'::jsonb,
     NOW()),
    ('evt_004', site_id, 'upgrade_clicked', true,
     '[{"key": "from_plan", "type": "string", "mode": "dimension"}, {"key": "to_plan", "type": "string", "mode": "dimension"}]'::jsonb,
     '{"mode": "none"}'::jsonb,
     NOW())
    ON CONFLICT (site_id, event_name) DO NOTHING;
    
    RAISE NOTICE 'event_defs created';
    
    -- ============================================
    -- 13. DIM_CARDINALITY
    -- ============================================
    RAISE NOTICE 'Generating dim_cardinality data...';
    
    FOR i IN 0..29 LOOP
        INSERT INTO dim_cardinality (site_id, day, dimension, value_hash)
        SELECT
            site_id,
            CURRENT_DATE - (i || ' days')::INTERVAL,
            'path',
            MD5('/page_' || j)
        FROM generate_series(1, 50) j
        ON CONFLICT DO NOTHING;
        
        INSERT INTO dim_cardinality (site_id, day, dimension, value_hash)
        SELECT
            site_id,
            CURRENT_DATE - (i || ' days')::INTERVAL,
            'utm_campaign',
            MD5('campaign_' || j)
        FROM generate_series(1, 20) j
        ON CONFLICT DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'dim_cardinality data generated';
    
    RAISE NOTICE 'Comprehensive mock data generation complete!';
END $$;

