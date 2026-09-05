# Security Policy

Agent Treasury sits on a payment-control boundary. Please treat suspected credential exposure, payment bypasses, duplicate-charge paths, policy bypasses, and incorrect reconciliation as security-sensitive.

## Reporting a vulnerability

Do not publish secrets, wallet sessions, private keys, seed phrases, recipient information, or exploitable payment details in a public issue.

Contact [@menghaoran214 on X](https://x.com/menghaoran214) and request a private reporting channel. Include only a short, non-sensitive summary in the initial message. A reproducible report may then include the affected version, impact, safe reproduction steps, and suggested remediation through the agreed private channel.

## Supported version

The project is still a pre-release prototype. Only the latest commit on the default branch is actively reviewed. There is no production security-support commitment yet.

## Payment-safety guarantees

- Mock settlement is the default.
- Real payment is opt-in and route-scoped.
- Treasury never requests or stores seed phrases or private keys.
- An uncertain payment is frozen for reconciliation and is never retried automatically.
- A procurement preference cannot override approval, security, or hard spending limits.

Public blockchain transaction identifiers intentionally retained as product evidence are not credentials, but they can link wallet activity and should be treated as permanent public data.
