# afrovision

A multi-surface project (Flutter app + Next.js website/admin + Node backend).

## Getting Started

This project includes:
- Flutter app in `lib/`
- Website (Next.js) in `website/`
- Admin (Next.js) in `admin/`
- Backend (Node/Express) in `backend/`

## Reports

- Repeated Fetches & Listeners Audit: see [reports/repeated-fetches-audit.md](reports/repeated-fetches-audit.md) for a source-focused inventory of polling, lifecycle-triggered fetches, listeners/subscriptions, duplicate endpoints, and high-frequency UI-driven updates across Flutter, Website, Admin, and Backend.
- Remediation Backlog: see [reports/repeated-fetches-remediation-backlog.md](reports/repeated-fetches-remediation-backlog.md) for prioritized HIGH/MEDIUM remediation tasks with suggested fixes and acceptance criteria.
- Remediation Playbook: see [reports/repeated-fetches-remediation-playbook.md](reports/repeated-fetches-remediation-playbook.md) for the recommended implementation patterns for debouncing, centralized polling, query caching, stream consolidation, and effect dependency fixes.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
