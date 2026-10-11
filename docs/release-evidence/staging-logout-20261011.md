# Staging logout fix

The dashboard used a Next.js link for `/auth/logout`, issuing GET to a POST-only route. Replace it with a native POST form and a submit button. Successful logout redirects with HTTP 303 to the existing `/auth/login` page.

Hosted browser verification: the signed-in admin dashboard showed two synthetic trips. Clicking the updated button signed out; a fresh visit to `/dashboard` redirected to `/auth/login?redirectTo=%2Fdashboard`, showing the email/password sign-in form instead of private trip data. The initial redirect mistakenly targeted `/login`; this was corrected immediately to `/auth/login` in source 0fda80b346067568497125ccfd321b2aa5f424ab.

Local validation: web type checking and lint passed. All 648 web tests across 89 suites passed, including a regression asserting sign-out and the HTTP 303 redirect target. The production deployment hold remains enabled.
