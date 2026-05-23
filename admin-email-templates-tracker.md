# Email Templates Feature Implementation Phases

## Phase 1: Admin Email Templates UI
- [x] Add "Email Templates" to admin navigation
- [x] List all templates from `email_templates/`
- [x] Implement template selection and default assignment
- [x] Integrate robust WYSIWYG HTML editor (with variable support)
- [x] Add live preview section
- [x] Save, revert, and create new template actions
- [x] Permissions: restrict to admin

## Phase 2: Template Integration & Backend Wiring
- [x] Parse and store templates from `email_templates/`
- [x] Update audition confirmation flow to use `email-audition-confirmation.html`
- [x] Update registration flow to send `email-1-welcome.html`
- [x] Add `email-2-hype.html` as default marketing template
- [x] Add `mail-3-countdown.html` as default countdown template
- [x] Ensure variable substitution (`{{name}}`, `{{email}}`, etc.)

## Phase 3: Test Email Templates Section
- [x] Add test email form to admin templates page
- [x] Allow admin to select template, enter test address, and send
- [x] Show preview and send result feedback

## Phase 4: QA & Polish
- [ ] End-to-end test all flows (admin, backend, email delivery)
- [x] Validate permissions, error states, and edge cases
- [x] Final review and documentation

## Verification Snapshot (Current)
- [ ] Admin lint command currently fails on Next.js 16 CLI lint invocation (`next lint` behavior changed)
- [x] Admin production build passes
- [x] Backend smoke/static tests pass
- [x] Runtime: templates list API returns 4 templates
- [x] Runtime: save API returns success true
- [x] Runtime: email templates page responds with HTTP 200
- [ ] Runtime: test-send API returns HTTP 500 (SMTP/runtime config still required)

## Final Review Notes
- Email template management UI now supports HTML and WYSIWYG editing, variable insertion (`{{name}}`, `{{email}}`), create/save/revert actions, live preview, and test-send feedback states.
- Template filesystem resolution remains compatible with both `email _templates` and `email_templates` directory naming.
- The only remaining unchecked phase item is true end-to-end delivery verification, currently blocked by SMTP runtime configuration in this environment.
