# Queued Supabase Auth Email Templates

These branded templates are for Supabase Auth:

- `confirm-signup.html` -> Authentication email template: **Confirm signup**
- `magic-link.html` -> Authentication email template: **Magic Link**

Recommended subjects:

- Confirm signup: `Confirm your Queued account`
- Magic Link: `Your Queued magic link`

For the current app flow, `src/pages/LoginPage.jsx` calls `supabase.auth.signInWithOtp(...)`. Supabase uses the Magic Link template for both existing-user login and automatic new-user signup unless email confirmation settings require the separate Confirm signup template.

Hosted Supabase projects can paste these into **Authentication > Emails > Templates** in the Supabase Dashboard. Supabase also supports managing these templates through the Management API via the `mailer_templates_*_content` and `mailer_subjects_*` auth config fields.

Sources checked:

- Supabase Email Templates docs: https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase Passwordless Email Login docs: https://supabase.com/docs/guides/auth/auth-email-passwordless
