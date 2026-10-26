Project Y2K — Product Architecture & Implementation Planning

Act as a senior full-stack engineer, product designer, security-minded payment systems engineer, and pragmatic startup CTO.

I am building Project Y2K, a ticket-booking website for a physical party happening on November 15, 2026. I want you to help me plan the implementation properly before we start coding.

Your job is to produce a concrete, implementation-ready technical plan that balances excellent design, reliability, speed of development, and near-zero infrastructure costs.

Do not overengineer this project. Think like a startup CTO who has to ship a polished, reliable product in approximately three days.

1. Project constraints

These constraints are mandatory.

* Event capacity: approximately 300 attendees.
* Expected peak concurrency: 50–70 users, with 100 concurrent users as a realistic upper planning estimate.
* Development target: a working initial version within three days.
* Frontend hosting: Vercel free tier, provided the current terms and project requirements permit it.
* Infrastructure budget: as close to ₹0 as reasonably possible, excluding unavoidable payment processing fees, domain costs, or paid services we explicitly approve.
* This is a single-event ticketing product, not a SaaS platform.
* The initial version only needs to support this event and a straightforward administrative workflow.
* We want an exceptional, visually distinctive landing page, not a generic template.
* We do not need microservices, Kubernetes, complicated message queues, enterprise analytics, or infrastructure designed for thousands of concurrent users.
* Avoid introducing additional infrastructure merely because it is considered industry best practice.
* Use free tiers where appropriate, but do not assume that a free tier has unlimited usage or guaranteed availability.
* Do not introduce Google authentication. It is unnecessary for purchasing tickets and does not guarantee collection of a phone number.

The expected workload is small. Optimize for simplicity, correctness, and a great customer experience.

2. Product vision and design direction

Project Y2K is a party brand. Its website should feel like entering the world of a real event, not visiting an ordinary business website.

The landing page is the primary marketing and conversion experience.

Explore a distinctive Y2K-inspired visual direction using appropriate combinations of chrome, metallic gradients, flash photography, futuristic typography, bold editorial layouts, grain, motion, and interactive elements.

However:

* Do not make the website look AI-generated.
* Do not blindly use generic neon gradients, excessive glassmorphism, random glowing cards, or unnecessary animations.
* Establish a consistent visual identity and a clear visual hierarchy.
* Make the design excellent on mobile first, since most visitors will arrive through Instagram and WhatsApp.
* Make the website fast, accessible, responsive, and usable on low-to-mid-range phones.
* Use motion purposefully, respect reduced-motion preferences, and avoid effects that delay purchasing.
* Do not let visual experimentation compromise checkout, QR scanning, or performance.
* Use genuine event imagery and supplied assets when available. Do not invent event facts, venue details, artists, sponsors, or promises.

The event’s actual brand assets, party description, venue, pricing, pass categories, and other content may not yet be finalized. Identify these as configuration inputs instead of inventing them.

Recommend the landing-page sections and the complete user journey. Explain which design elements are worth implementing within the three-day schedule and which can wait.

3. Required customer journey

A visitor should be able to:

1. Open the public event URL without creating an account.
2. Understand the party, date, venue, rules, and available passes.
3. Select a pass type and quantity.
4. Enter attendee information:
    * Full name
    * Phone number
    * Email address
    * Instagram handle
5. Review the order, total amount, and applicable fees before paying.
6. Complete payment through an appropriate payment gateway.
7. Receive a confirmed ticket after payment has been verified server-side.
8. View their ticket on the website.
9. Receive their ticket by email when an email address has been supplied.
10. Reopen or recover their ticket later through a secure mechanism.

Google authentication is not required.

Decide whether to collect details separately for each attendee or only for the purchaser. Prefer a sensible data model that supports multiple passes in one order without creating unnecessary friction.

Do not assume that a browser redirect to a success page proves payment. The backend must verify payment through the provider’s supported verification process and authenticated webhooks.

Handle delayed payment confirmations, failed payments, duplicate webhook delivery, abandoned checkout, and email delivery failures.

The customer must never receive a falsely confirmed ticket just because their browser reports success.

4. Pass inventory and ticket generation

The organizer should be able to configure:

* Pass names and descriptions.
* Prices and applicable fees.
* Total inventory for each pass type.
* Sales start and end times.
* Whether a pass is available for purchase.
* The number of admissions represented by a pass.

A couple pass or another multi-admission pass may require special handling. Explain the simplest reliable approach.

Inventory must never be oversold because two people purchase the last available pass simultaneously.

Use database transactions and appropriate atomic inventory updates. If temporary inventory reservations are needed, implement a simple expiration mechanism rather than introducing unnecessary infrastructure.

After payment confirmation:

* Create unique ticket records.
* Generate cryptographically secure, unguessable ticket tokens.
* Generate QR codes that reference those tokens.
* Save the ticket records in the database.
* Display the ticket to the customer.
* Send the ticket email, if applicable.

Never put personal information directly into a QR code.

Distinguish between an order, a payment, and an individual admission ticket. One order may contain multiple tickets.

5. Volunteer scanning and entry management

This feature is essential, not optional.

Build a mobile-friendly scanner interface for event-day volunteers.

Required capabilities:

* Authorized volunteers log in using individual accounts.
* Volunteers can scan QR codes using their phone cameras.
* The backend validates every scan.
* A valid, unused ticket is checked in exactly once.
* A previously used ticket is rejected.
* Invalid, cancelled, and refunded tickets are rejected.
* Network failures are clearly distinguished from invalid tickets and successful entry.
* The interface gives immediate, unmistakable feedback.
* Record the volunteer, ticket, timestamp, and relevant scan outcome.
* Provide an admin-accessible attendee lookup as a backup to camera scanning.

Duplicate-entry prevention must be enforced on the server, not merely in the browser.

Two volunteers scanning the same ticket at almost the same moment must not both admit the attendee. Use an atomic database transaction or conditional update.

Do not build offline scanning in the initial version unless you determine that reliable internet at the venue cannot reasonably be arranged. Explain the risks and recommend a practical connectivity backup.

Volunteers must not have access to payment configuration, refunds, ticket creation, or unrestricted attendee exports.

6. Admin dashboard

Keep the dashboard functional rather than elaborate.

The administrator needs to:

* See total tickets sold, available inventory, and check-ins.
* See orders and payment statuses.
* Search attendees by name, phone number, ticket ID, or Instagram handle.
* View individual ticket status.
* Manage pass types and their availability.
* View check-in history.
* Create and revoke volunteer accounts or access.
* Initiate or manage refunds through an authorized workflow.
* Export an attendee list and check-in report to CSV.
* Reconcile payment gateway transactions against internal records.

Show gross collections, refunds, fees where available, and net collections as distinct figures. Clearly define how each number is calculated.

Include audit logs for sensitive administrative actions.

Protect all administrative endpoints on the server. Hiding a button in the frontend is not authorization.

Do not build sophisticated charts or advanced analytics unless they materially help run this event.

7. Architecture and technology selection

My initial preference is:

* Next.js with TypeScript for the website and interfaces.
* Vercel free tier for frontend hosting and, if appropriate, supported server-side functionality.
* Managed PostgreSQL using a suitable free or low-cost tier.
* A suitable Indian payment gateway, potentially Razorpay, subject to current eligibility, onboarding, category approval, and fees.
* A transactional email provider with a suitable free tier.
* A maintained QR-generation library.
* A maintained browser-compatible QR-scanning library.
* A lightweight authentication solution for staff accounts.

Evaluate whether a single Next.js application with server-side route handlers is sufficient for this workload.

Prefer the simplest viable architecture. Do not automatically introduce a separate Python FastAPI backend unless it offers a concrete benefit that justifies another deployment, configuration, and operational burden.

If the simplest approach is a single Next.js application with managed PostgreSQL, explain why.

If a separate backend is genuinely better, explain the trade-off and the additional costs or operational complexity.

Do not add Redis, WebSockets, background worker services, a separate microservice architecture, or an ORM solely out of habit. Introduce a dependency only when there is a clear reason.

Use a proper database access layer, migrations, environment variables, and appropriate input validation.

Use supported, production-compatible package versions. Avoid unnecessary dependencies and verify that any proposed library is maintained and compatible with the chosen deployment environment.

8. Free-tier and deployment verification

Do not assume current free-tier terms from memory.

Identify and verify the current official documentation for:

* Vercel free-tier limits and commercial-use eligibility.
* Serverless function execution limits and runtime constraints.
* Managed PostgreSQL storage, connection limits, compute quotas, and inactivity policies.
* Transactional email sending limits and domain verification requirements.
* Payment gateway onboarding requirements, fees, and webhook support.

Use official documentation where possible.

Assess the proposed workload: 300 attendees, up to 100 concurrent website users, a burst of purchases, and several volunteers scanning tickets simultaneously.

Distinguish between concurrent visitors, concurrent HTTP requests, and simultaneous database transactions.

Estimate whether the proposed architecture is sufficient and identify any likely bottlenecks. Do not claim that the expected traffic is guaranteed to be supported simply because it is relatively small.

Keep the design stateless where practical. Use a managed database as the authoritative source of ticket and payment state.

Never rely on in-memory serverless state for inventory, payment status, authentication, or duplicate-scan prevention.

Do not assume that a service offering a free tier is appropriate for commercial event ticket sales without checking its terms.

Use environment variables for secrets. Do not commit API keys, webhook secrets, database credentials, or privileged tokens.

9. Data model and backend contracts

Propose the minimum database schema required for:

* Events
* Pass types
* Attendees
* Orders
* Order items, if needed
* Payments
* Tickets
* Check-ins
* Staff users and roles
* Audit logs

Explain the relationships, essential indexes, uniqueness constraints, and fields that prevent duplicate payment processing or duplicate entry.

Clearly distinguish payment status from ticket status.

Provide the minimum API contracts needed for:

* Public event information.
* Creating an order.
* Initiating payment.
* Receiving and verifying payment webhooks.
* Retrieving tickets securely.
* Staff authentication.
* Scanning and checking in a ticket.
* Admin order and attendee search.
* Inventory management.
* Authorized refunds.
* CSV exports.

Avoid designing APIs for hypothetical future features.

Specify which operations must be transactional, idempotent, rate-limited, or restricted by role.

Do not expose sensitive attendee data through public endpoints.

10. Security and reliability

Focus on realistic risks for a small event.

Address:

* Server-side payment verification.
* Webhook signature verification and idempotency.
* Inventory race conditions and overselling.
* Atomic duplicate-scan prevention.
* Secure ticket tokens and ticket-recovery links.
* Authentication and role-based authorization.
* Rate limiting and abuse prevention.
* Input validation and output escaping.
* Protection of personal information.
* Secure handling of environment variables.
* Database backups and recovery.
* Refunds and ticket revocation.
* Error logging without leaking secrets or unnecessary personal data.

Do not add security infrastructure that is disproportionate to the product. Implement essential protections directly and use established managed services where appropriate.

11. Testing and event-day operations

Create a focused test plan covering:

1. Successful purchase and ticket delivery.
2. Payment success when the customer closes the browser.
3. Failed and delayed payments.
4. Duplicate webhook delivery.
5. Two buyers competing for the last pass.
6. Duplicate QR scans from different phones.
7. Refunds and ticket revocation.
8. Unauthorized volunteer and admin actions.
9. Email failure and ticket recovery.
10. Camera permissions and mobile browser compatibility.
11. Poor network connectivity at the venue.
12. A burst of simultaneous visitors and purchases.

Include unit tests for business logic, integration tests for payment and ticket issuance, and end-to-end tests for the most important user journeys.

Use the payment gateway’s test mode. Do not run uncontrolled real-money tests.

Prepare an event-day checklist that includes checking the venue’s mobile internet, testing all volunteer devices, verifying attendee exports, preparing a backup check-in process, and ensuring access to administrative accounts.

12. Three-day execution plan

Create a realistic three-day development schedule.

For each day, specify:

* The exact deliverables.
* The implementation order.
* Which features are critical and which can be postponed.
* Dependencies and blockers.
* How to test completion.
* What must be deployed by the end of the day.

Prioritize in this order:

1. Functional architecture and database.
2. Purchase, payment verification, and ticket issuance.
3. Volunteer scanner and duplicate-entry prevention.
4. Landing page design and responsive polish.
5. Admin dashboard and operational reporting.
6. Final testing and deployment.

Adjust the order if needed to reduce integration risk, but never leave payment correctness or entry validation until the final hours.

Assume one primary developer working with Claude Code or a similar AI-assisted development workflow. Optimize for changes that can be implemented, tested, and deployed quickly.

13. What I want you to deliver NOW

We are currently in the ideation and planning phase.

Do not start coding yet. Do not create files or make code changes.

First deliver the following:

A. Executive recommendation

Describe the simplest suitable architecture and explain why it fits the workload, budget, and deadline.

B. Architecture diagram

Show the browser, Next.js application, payment gateway, managed database, email provider, and volunteer scanner, including the important request and payment flows.

C. Feature specification

Separate essential launch features from optional enhancements.

D. Database schema

Provide the proposed tables, important fields, relationships, constraints, and indexes.

E. Critical workflows

Describe order creation, inventory reservation, payment verification, ticket generation, email delivery, refund handling, and atomic check-in.

F. Three-day implementation schedule

Give a practical sequence with deliverables and acceptance criteria.

G. Environment and deployment plan

List the services, environment variables, domain setup, webhook configuration, database migrations, and deployment steps.

H. Cost and capacity assessment

Estimate expected costs, free-tier constraints, likely failure points, and how the application will behave during a traffic burst.

I. Risk register

List the highest-impact risks, their likelihood, their consequences, and practical mitigations.

J. Acceptance checklist

Define exactly what must work before ticket sales go live and what must be tested before the event.

K. Open decisions

Ask only the questions whose answers materially affect architecture or implementation. Separate those from ordinary content and branding details that can be filled in later.

14. Working rules

* Be pragmatic and direct.
* Do not overengineer.
* Do not invent finalized business requirements.
* State assumptions explicitly.
* Flag anything that cannot safely be postponed.
* Prefer official documentation for current provider limits and policies.
* Keep the implementation within the stated budget wherever feasible.
* Do not build for imaginary scale.
* Do not compromise payment correctness, ticket validity, or duplicate-entry prevention for speed.
* Optimize for a beautiful customer-facing experience and an extremely reliable entry workflow.
* Explain important technical decisions in plain English so I can evaluate them as a founder, even if I have not considered every edge case.

After delivering the plan, stop and wait for my approval before writing implementation code.

The final objective is simple: a visually exceptional Project Y2K landing page, successful online ticket sales, reliable QR tickets, and smooth entry for approximately 300 people, shipped with minimal cost and complexity.