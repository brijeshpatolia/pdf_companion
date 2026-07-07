# PDF Companion

An AI reading companion web app — the AI is always on your current page and remembers everything you've read. See `SPEC.md` for the product spec.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues in `github.com/brijeshpatolia/pdf_companion`, managed via the `gh` CLI. External PRs are **not** a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label vocabulary, default strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
