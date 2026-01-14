# No Name Analytics: Privacy-First Web Analytics Without Consent Requirements

No Name Analytics is an open source, self-hosted web analytics platform designed as a complete (and better *<:) ) Google Analytics 4 alternative. Built with privacy by design, it provides comprehensive website analytics without requiring user consent, cookies, or tracking personal information. For a website operator this ensures 100% session caption. Better data = better decisions. 

## Why Choose No Name Analytics Over Google Analytics 4?

As privacy regulations like GDPR and CCPA become stricter, many website owners are seeking Google Analytics alternatives that don't require consent banners. No Name Analytics solves this problem by:

- **No Consent Required**: Privacy-first architecture means no cookies, no PII storage, and no IP tracking. This eliminates the need for cookie consent banners while still providing valuable insights.

- **Complete Data Ownership**: Self-hosted solution means you own and control all your analytics data. No third-party data sharing or vendor lock-in.

- **Full GA4 Feature Parity**: Comprehensive analytics including real-time tracking, custom events, funnels, conversions, attribution models, cohort analysis, and more.

- **Lightweight Tracker**: Ultra-lightweight JavaScript tracker under 10KB gzipped, faster than GA4 and better for Core Web Vitals.

- **Transparent and Open Source**: MIT licensed open source code means full transparency, security audits, and community contributions.

## Key Features

### Privacy and Compliance

- **Zero Cookies**: Uses localStorage for visitor identification, no cookies required
- **No PII Storage**: Automatically sanitizes and removes personally identifiable information
- **No IP Tracking**: IP addresses are never stored or logged
- **GDPR Compliant**: Designed to comply with privacy regulations without consent banners
- **Data Minimization**: Only collects essential metrics, nothing more

### Comprehensive Analytics

- **Real-Time Dashboard**: Live event streaming with server-sent events
- **Custom Events**: Track any custom events with flexible property schemas
- **Conversion Tracking**: Goal-based conversions with funnel analysis
- **Attribution Models**: Multiple attribution models including first touch, last touch, linear, time decay, and data-driven
- **Cohort Analysis**: User cohort tracking and retention analysis
- **Multi-Channel Funnels**: Understand the full customer journey across channels
- **A/B Testing**: Built-in A/B test analysis with statistical significance testing
- **Lifetime Value**: Calculate and analyze customer lifetime value by channel and cohort

### Advanced Capabilities

- **Query Explorer**: Build custom reports with flexible dimension and metric combinations
- **Custom Dimensions**: Define user-scoped, session-scoped, and event-scoped dimensions
- **Calculated Metrics**: Create custom metrics with formula support
- **Advanced Segmentation**: Build complex user segments with condition builders
- **Anomaly Detection**: Automatic detection of unusual metric patterns with ML-based methods
- **Scheduled Reports**: Automated reports via email or webhook
- **Custom Dashboards**: Drag-and-drop dashboard builder
- **Problems Dashboard**: Prioritized list of actionable issues with impact scoring, evidence, and sample sessions

### Developer and UX Tools

- **Error Tracking**: Sentry-style error logging with stack traces and breadcrumbs
- **Performance Monitoring**: Track API call duration, status, and resource loading times
- **Heatmaps**: Visualize click, scroll, and mouse movement patterns (opt-in, disabled by default)
- **Form Analytics**: Track form field interactions, time spent, and abandonment
- **Session Replay**: Record and replay user sessions for debugging (opt-in, masking-by-default)
- **Frustration Signals**: Detect rage clicks, dead clicks, and excessive scrolling

### Marketing Tools

- **Campaign ROI Dashboard**: Track campaign costs, revenue, conversions, CPA, and LTV
- **Landing Page Performance**: Compare landing page variants by conversion rate and revenue
- **Content Performance**: Identify high-converting pages and content
- **Channel Effectiveness**: Analyze marketing channel quality with statistical significance

### Production-Grade Analytics Core

- **Intelligent Problem Detection**: Automatically identifies and prioritizes actionable issues with impact scoring
  - Error spikes with conversion impact analysis
  - Performance slowdowns with baseline comparison
  - Funnel conversion drops with statistical significance
  - UX friction detection (rage clicks, dead clicks, form abandonment)
  - Root cause analysis with correlation chains
- **Data Normalization & Governance**: Prevents cardinality explosion and ensures data quality
  - URL path normalization with query parameter allowlists
  - URL templating (UUID/ID replacement for performance metrics)
  - CSS selector normalization (strict/lenient modes)
  - Server-side cardinality limits with configurable thresholds
  - Automatic bucketing of excessive dimension values
  - Comprehensive audit trail for all data drops and mutations
- **Statistical Analysis**: Advanced statistical methods for reliable insights
  - Conversion lift calculation with confidence intervals (Wilson score)
  - Two-proportion z-test for statistical significance
  - Delta engine for baseline vs. current comparison
  - Z-score confidence intervals for change detection
- **Reliable Event Delivery**: Production-ready client-side reliability
  - localStorage queue (200 payloads/2MB max) with automatic retry
  - Exponential backoff on failures
  - sendBeacon fallback for reliable delivery
  - Debug mode for development (noisy logs gated behind flag)

### Enterprise Features

- **Business Impact Translation**: Understand the real-world impact of problems
  - Revenue impact calculation based on affected sessions
  - Cost-to-fix estimates
  - ROI calculations for problem resolution
  - Business metrics configuration (avg revenue per session, conversion rates)
- **Predictive Analytics**: ML-based insights for proactive problem detection
  - Anomaly detection using Z-score and IQR methods
  - Time-series forecasting with linear regression
  - Problem severity prediction
  - Trend analysis (increasing/decreasing/stable)
- **Incident Management Integration**: Connect problems to your existing workflows
  - PagerDuty integration for critical alerts
  - Slack notifications with rich problem details
  - Webhook support for custom integrations
  - Alert routing rules (filter by problem type, severity)
- **REST API**: Programmatic access to analytics data
  - API key management with granular permissions
  - Problems endpoint for integration with external tools
  - Sites and events endpoints
  - Rate limiting and usage monitoring
- **Enterprise Security & Compliance**
  - SSO/SAML authentication (Google, Microsoft, Okta)
  - IP allowlisting for enhanced security
  - User audit logs for compliance tracking
  - GDPR/CCPA compliance endpoints (data export, deletion)
  - Data retention policies with automatic cleanup
- **Privacy-First Architecture**
  - PII masking enabled by default
  - Opt-in features (heatmaps, replay) disabled by default
  - Server-side privacy enforcement
  - Documented data collection and retention controls
  - Site-specific privacy configuration

## Technology Stack

No Name Analytics is built with modern, battle-tested technologies:

### Frontend

- **Next.js 14**: React framework with App Router for the analytics dashboard
- **React 18**: UI library for building interactive dashboards
- **Tailwind CSS**: Utility-first CSS framework for styling
- **shadcn/ui**: High-quality React component library built on Radix UI
- **Recharts**: Composable charting library for data visualization
- **TypeScript**: Type-safe development for better code quality

### Backend

- **Fastify**: High-performance web framework for the event collector
- **Node.js 20+**: JavaScript runtime environment
- **PostgreSQL 16**: Robust relational database for analytics data
- **Redis**: In-memory data store for real-time streaming and rate limiting
- **Drizzle ORM**: Type-safe SQL toolkit for database operations

### Data Processing

- **Zod**: Schema validation for type-safe data processing
- **nanoid**: URL-safe unique ID generation
- **ioredis**: Redis client for Node.js

### Infrastructure

- **Docker Compose**: Container orchestration for easy self-hosting
- **Turbo**: Monorepo build system for fast development
- **pnpm**: Efficient package manager

### Tracker Script

- **TypeScript**: Type-safe tracker development
- **ESBuild**: Fast JavaScript bundler for minimal bundle size

## Quick Start

### Prerequisites

- Node.js 20 or higher
- pnpm 8 or higher
- Docker and Docker Compose (for self-hosting)

### Docker Compose Installation (Recommended)

The fastest way to get started is using Docker Compose:

```bash
# Start infrastructure services (PostgreSQL, Redis)
docker-compose up -d

# Install dependencies
pnpm install

# Run database migrations
pnpm migrate

# Start all services in development mode
pnpm dev
```

Once started, access the dashboard at `http://localhost:3000` and the collector API at `http://localhost:3001`.

### Manual Installation

For production deployments or custom configurations, see the [Setup Guide](SETUP.md) for detailed installation instructions.

## Installation and Setup

### 1. Add the Tracker Script

Add the No Name Analytics tracker to your website:

```html
<script>
  (function() {
    var script = document.createElement('script');
    script.src = 'http://localhost:3001/script.js';
    script.setAttribute('data-site-id', 'YOUR_SITE_ID');
    script.setAttribute('data-site-key', 'YOUR_SITE_KEY');
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
```

Replace `YOUR_SITE_ID` and `YOUR_SITE_KEY` with your actual site credentials from the dashboard.

### 2. Verify Installation

Visit your website and check the browser console for confirmation messages. You can also use the verification tool in the admin dashboard.

### 3. Start Tracking

The tracker automatically captures:
- Pageviews
- Clicks on links and buttons
- Form submissions
- Outbound link clicks
- Scroll depth
- Video engagement
- File downloads
- Custom events

## Architecture

No Name Analytics uses a modular monorepo architecture:

- **collector**: Fastify-based service handling event ingestion, real-time streaming via Server-Sent Events, and rate limiting
- **web**: Next.js dashboard providing site management, analytics visualization, and user interface
- **script**: Minimal client-side tracker script optimized for size and performance
- **db**: Shared database package with Drizzle ORM schemas and query functions
- **shared**: Common utilities for path normalization, event key generation, privacy sanitization, and validation

## Privacy and Data Protection

### What We Don't Track

- IP addresses
- Full user agent strings
- Email addresses or personal information
- Cross-site tracking
- Fingerprinting

### What We Do Track

- Page views and navigation paths
- Custom events and conversions
- Device category (desktop, mobile, tablet)
- Operating system
- Country (from IP, but IP is not stored)
- Referrer domains
- UTM campaign parameters
- Browser name and version
- Screen dimensions

All data is aggregated and anonymized. Individual user tracking is limited to session-based analytics only.

### E-Commerce Websites

Track product views, add-to-cart events, purchases, and revenue. Analyze conversion funnels, customer lifetime value, and marketing channel effectiveness.

### Content Websites

Understand which content performs best, track engagement metrics, analyze user flow, and optimize content strategy based on data.

### SaaS Applications

Monitor user onboarding funnels, track feature usage, analyze retention, and measure the impact of product changes.

### Marketing Teams

Measure campaign ROI, compare landing page variants, analyze multi-channel attribution, and optimize marketing spend.

### Development & UI/UX Teams

Debug JavaScript errors, monitor API performance, track user frustration signals, and improve user experience through heatmaps and session replay.

## Roadmap

### Recently Completed (Production-Grade Core)

- **Intelligent Problem Detection**: Automatic detection of error spikes, performance slowdowns, funnel drops, UX friction, and form abandonment with impact scoring and statistical analysis

- **Data Governance**: URL/selector normalization, cardinality limits, audit trails, and comprehensive data quality controls

- **Statistical Analysis**: Conversion lift with confidence intervals, baseline comparison, and significance testing

- **Enterprise Features**: REST API, SSO/SAML, IP allowlisting, user audit logs, GDPR/CCPA compliance, incident integrations

- **Predictive Analytics**: Anomaly detection, forecasting, and problem severity prediction

- **Business Impact**: Revenue attribution, cost-to-fix estimates, and ROI calculations

### Future Enhancements

- Mobile app SDKs (iOS, Android)
- White-label options and customization
- Advanced ML models for anomaly detection
- GraphQL API
- Additional data export formats (Parquet, BigQuery)
- Multi-region deployment and data residency
- Advanced alerting rules and conditions
- Custom problem detection rules
- Integration marketplace

## Contributing

We welcome contributions from the community. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Code style and standards
- Pull request process
- Issue reporting
- Feature requests


## Support

- **Documentation**: Comprehensive guides in the `/docs` directory
- **Issues**: Report bugs or request features on GitHub
- **Community**: Join discussions and get help from other users

## License and Usage

No Name Analytics uses a dual-license model.

### Server-side components
The backend, collector, and dashboard are licensed under the
**Business Source License 1.1 (BSL)**.

This means:

**You may:**
- Self-host No Name Analytics
- Use it internally within your organization
- Deploy it in production for your own analytics needs
- Modify the source code for internal use

**You may not:**
- Offer No Name Analytics as a hosted or managed service
- Resell or sublicense it
- White-label or rebrand it
- Use it to provide analytics services to third parties
- Bundle it into a commercial product or SaaS offering

### Client-side tracking script
The tracking script is licensed under the **MIT License** and may be embedded
freely on any website.

### Why this license?
No Name Analytics is intended to be:
- Privacy-first
- Free to self-host
- Transparent and auditable
- Protected against commercial resale and SaaS exploitation

If you wish to use No Name Analytics commercially or as a service, you must
obtain a separate license.

### Contact
alfgre@pm.me
