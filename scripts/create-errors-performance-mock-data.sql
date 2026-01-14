-- Mock Data for Errors and Performance Metrics
-- Site ID: c_6GXisG7x0y5K96i28ww

DO $$
DECLARE
    site_id TEXT := 'c_6GXisG7x0y5K96i28ww';
    v_now TIMESTAMP := NOW();
    v_ts TIMESTAMP;
    v_vid TEXT;
    v_sid TEXT;
    i INTEGER;
    j INTEGER;
    error_id_val TEXT;
    error_fingerprint TEXT;
    v_paths TEXT[] := ARRAY['/', '/pricing', '/features', '/blog', '/about', '/contact', '/signup', '/checkout', '/dashboard'];
    v_error_types TEXT[] := ARRAY['js', 'network', 'resource', 'promise'];
    v_error_messages TEXT[] := ARRAY[
        'TypeError: Cannot read property ''value'' of undefined',
        'Network request failed',
        'Failed to load resource: the server responded with a status of 404',
        'Uncaught Promise rejection: timeout',
        'ReferenceError: variable is not defined',
        'SyntaxError: Unexpected token',
        'TypeError: Cannot set property ''innerHTML'' of null',
        'Failed to fetch',
        'CORS policy: No ''Access-Control-Allow-Origin'' header',
        'ChunkLoadError: Loading chunk failed'
    ];
    v_error_urls TEXT[] := ARRAY['/', '/pricing', '/features', '/blog', '/signup', '/checkout', '/dashboard'];
BEGIN
    RAISE NOTICE 'Starting errors and performance metrics data generation...';
    
    -- ============================================
    -- ERRORS and ERROR_EVENTS
    -- ============================================
    RAISE NOTICE 'Generating errors and error_events data...';
    
    FOR i IN 1..100 LOOP
        v_ts := v_now - ((i * 7) || ' hours')::INTERVAL;
        error_id_val := 'err_' || LPAD(i::TEXT, 6, '0');
        error_fingerprint := MD5('error_' || i || '_' || site_id);
        
        INSERT INTO errors (
            id, site_id, fingerprint, type, message, url, environment, release, first_seen, last_seen, count, resolved
        )
        VALUES (
            error_id_val,
            site_id,
            error_fingerprint,
            v_error_types[1 + (i % array_length(v_error_types, 1))],
            v_error_messages[1 + (i % array_length(v_error_messages, 1))],
            v_error_urls[1 + (i % array_length(v_error_urls, 1))],
            CASE WHEN random() > 0.8 THEN 'staging' ELSE 'production' END,
            '1.0.' || (i % 10),
            v_ts,
            v_ts + (random() * INTERVAL '6 hours'),
            (random() * 500 + 1)::INTEGER,
            CASE WHEN random() > 0.9 THEN true ELSE false END
        )
        ON CONFLICT ON CONSTRAINT errors_site_id_fingerprint_key DO UPDATE SET
            last_seen = GREATEST(errors.last_seen, EXCLUDED.last_seen),
            count = errors.count + EXCLUDED.count;
        
        -- Generate error events for this error (5-50 occurrences)
        FOR j IN 1..(5 + (random() * 45)::INTEGER) LOOP
            v_vid := 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0');
            v_sid := 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0');
            
            INSERT INTO error_events (error_id, site_id, vid, sid, path, ts, user_agent, props)
            VALUES (
                error_id_val,
                site_id,
                v_vid,
                v_sid,
                v_paths[1 + ((i + j) % array_length(v_paths, 1))],
                v_ts + (random() * INTERVAL '6 hours'),
                CASE (j % 5)
                    WHEN 0 THEN 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                    WHEN 1 THEN 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    WHEN 2 THEN 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
                    WHEN 3 THEN 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
                    ELSE 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)'
                END,
                jsonb_build_object(
                    'user_id', 'user_' || j,
                    'plan', CASE WHEN random() > 0.5 THEN 'pro' ELSE 'free' END,
                    'browser', CASE (j % 4)
                        WHEN 0 THEN 'Chrome'
                        WHEN 1 THEN 'Safari'
                        WHEN 2 THEN 'Firefox'
                        ELSE 'Edge'
                    END,
                    'os', CASE (j % 5)
                        WHEN 0 THEN 'macOS'
                        WHEN 1 THEN 'Windows'
                        WHEN 2 THEN 'iOS'
                        WHEN 3 THEN 'Linux'
                        ELSE 'Android'
                    END
                )
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'errors and error_events data generated';
    
    -- ============================================
    -- PERFORMANCE_METRICS
    -- ============================================
    RAISE NOTICE 'Generating performance_metrics data...';
    
    DECLARE
        api_endpoints TEXT[] := ARRAY['/api/data', '/api/users', '/api/sessions', '/api/events', '/api/analytics', '/api/reports'];
        resource_files TEXT[] := ARRAY[
            '/static/js/app.js',
            '/static/js/vendor.js',
            '/static/css/app.css',
            '/static/images/logo.png',
            '/static/fonts/roboto.woff2',
            '/static/js/chart.js',
            '/static/js/utils.js'
        ];
        nav_routes TEXT[] := ARRAY['/', '/pricing', '/features', '/blog', '/signup'];
    BEGIN
        -- Generate data for last 30 days
        FOR i IN 0..720 LOOP -- 30 days * 24 hours
            v_ts := v_now - (i || ' hours')::INTERVAL;
            
            -- API calls (10-50 per hour)
            FOR j IN 1..(10 + (random() * 40)::INTEGER) LOOP
                INSERT INTO performance_metrics (site_id, ts, type, name, duration, status, size, props)
                VALUES (
                    site_id,
                    v_ts + (random() * INTERVAL '1 hour'),
                    'api',
                    api_endpoints[1 + (j % array_length(api_endpoints, 1))],
                    CASE 
                        WHEN random() > 0.9 THEN 1000 + (random() * 2000)::INTEGER  -- Slow requests
                        WHEN random() > 0.7 THEN 500 + (random() * 500)::INTEGER   -- Medium requests
                        ELSE 50 + (random() * 450)::INTEGER                          -- Fast requests
                    END,
                    CASE 
                        WHEN random() > 0.95 THEN 500  -- Server errors
                        WHEN random() > 0.9 THEN 404  -- Not found
                        WHEN random() > 0.85 THEN 403  -- Forbidden
                        ELSE 200                        -- Success
                    END,
                    CASE 
                        WHEN random() > 0.8 THEN 5000 + (random() * 50000)::INTEGER  -- Large responses
                        ELSE 1000 + (random() * 4000)::INTEGER                       -- Small responses
                    END,
                    jsonb_build_object(
                        'method', CASE (j % 4)
                            WHEN 0 THEN 'GET'
                            WHEN 1 THEN 'POST'
                            WHEN 2 THEN 'PUT'
                            ELSE 'DELETE'
                        END,
                        'vid', 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0'),
                        'sid', 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0')
                    )
                );
            END LOOP;
            
            -- Resource loads (20-100 per hour)
            FOR j IN 1..(20 + (random() * 80)::INTEGER) LOOP
                INSERT INTO performance_metrics (site_id, ts, type, name, duration, status, size, props)
                VALUES (
                    site_id,
                    v_ts + (random() * INTERVAL '1 hour'),
                    'resource',
                    resource_files[1 + (j % array_length(resource_files, 1))],
                    CASE 
                        WHEN random() > 0.9 THEN 500 + (random() * 1000)::INTEGER  -- Slow loads
                        WHEN random() > 0.7 THEN 200 + (random() * 300)::INTEGER  -- Medium loads
                        ELSE 10 + (random() * 190)::INTEGER                         -- Fast loads
                    END,
                    CASE 
                        WHEN random() > 0.98 THEN 404  -- Not found
                        WHEN random() > 0.95 THEN 500  -- Server error
                        ELSE 200                        -- Success
                    END,
                    CASE 
                        WHEN resource_files[1 + (j % array_length(resource_files, 1))] LIKE '%.js' THEN 50000 + (random() * 200000)::INTEGER
                        WHEN resource_files[1 + (j % array_length(resource_files, 1))] LIKE '%.css' THEN 10000 + (random() * 50000)::INTEGER
                        WHEN resource_files[1 + (j % array_length(resource_files, 1))] LIKE '%.png' THEN 20000 + (random() * 100000)::INTEGER
                        WHEN resource_files[1 + (j % array_length(resource_files, 1))] LIKE '%.woff2' THEN 15000 + (random() * 35000)::INTEGER
                        ELSE 10000 + (random() * 40000)::INTEGER
                    END,
                    jsonb_build_object(
                        'vid', 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0'),
                        'sid', 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0'),
                        'cache', CASE WHEN random() > 0.5 THEN 'hit' ELSE 'miss' END
                    )
                );
            END LOOP;
            
            -- Navigation timing (5-20 per hour)
            FOR j IN 1..(5 + (random() * 15)::INTEGER) LOOP
                INSERT INTO performance_metrics (site_id, ts, type, name, duration, status, size, props)
                VALUES (
                    site_id,
                    v_ts + (random() * INTERVAL '1 hour'),
                    'navigation',
                    nav_routes[1 + (j % array_length(nav_routes, 1))],
                    CASE 
                        WHEN random() > 0.9 THEN 3000 + (random() * 2000)::INTEGER  -- Slow navigation
                        WHEN random() > 0.7 THEN 1500 + (random() * 1500)::INTEGER -- Medium navigation
                        ELSE 200 + (random() * 1300)::INTEGER                       -- Fast navigation
                    END,
                    200,
                    NULL,
                    jsonb_build_object(
                        'vid', 'vid_' || LPAD(((i * 100 + j) % 5000)::TEXT, 4, '0'),
                        'sid', 'sid_' || LPAD(((i * 100 + j) % 10000)::TEXT, 4, '0'),
                        'dom_content_loaded', 100 + (random() * 500)::INTEGER,
                        'load_complete', 200 + (random() * 800)::INTEGER
                    )
                );
            END LOOP;
        END LOOP;
    END;
    
    RAISE NOTICE 'performance_metrics data generated';
    
    RAISE NOTICE 'Errors and performance metrics mock data generation complete!';
END $$;

