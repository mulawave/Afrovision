# Email Templates Feature Implementation Phases

## Phase 1: Admin Email Templates UI
- [ ] Add "Email Templates" to admin navigation
- [ ] List all templates from `email_templates/`
- [ ] Implement template selection and default assignment
- [ ] Integrate robust WYSIWYG HTML editor (with variable support)
- [ ] Add live preview section
- [ ] Save, revert, and create new template actions
- [ ] Permissions: restrict to admin

## Phase 2: Template Integration & Backend Wiring
- [ ] Parse and store templates from `email_templates/`
- [ ] Update audition confirmation flow to use `email-audition-confirmation.html`
- [ ] Update registration flow to send `email-1-welcome.html`
- [ ] Add `email-2-hype.html` as default marketing template
- [ ] Add `mail-3-countdown.html` as default countdown template
- [ ] Ensure variable substitution (`{{name}}`, `{{email}}`, etc.)

## Phase 3: Test Email Templates Section
- [ ] Add test email form to admin templates page
- [ ] Allow admin to select template, enter test address, and send
- [ ] Show preview and send result feedback

## Phase 4: QA & Polish
- [ ] End-to-end test all flows (admin, backend, email delivery)
- [ ] Validate permissions, error states, and edge cases
- [ ] Final review and documentation