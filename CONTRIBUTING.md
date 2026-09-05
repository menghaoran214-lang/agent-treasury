# Contributing

Agent Treasury is preparing for its first public release. Small, reviewable changes with reproducible evidence are preferred.

## Before opening a change

1. Explain the user-facing problem and the expected behavior.
2. Keep wallet custody, policy enforcement, settlement, delivery, and accounting as separate boundaries.
3. Do not commit `.env` files, local databases, logs, wallet sessions, QR data, private keys, seed phrases, or live credentials.
4. Use mock payment for tests unless a separately approved real-payment acceptance explicitly requires otherwise.
5. Run `npm run test:all` and, for UI changes, `npm run screenshot`.

## UI changes

Preserve the compact black-and-gold visual language, complete Simplified Chinese and English localization, and the three notification behaviors. Screenshots must show real current states rather than repeated placeholders. The screenshot command uses an isolated mock database and must never operate on the user's live database or real-payment mode.

## Security reports

Do not open a public issue for exploitable payment or credential findings. Follow [SECURITY.md](SECURITY.md).

## License

No public license has been declared. Submission or discussion does not grant permission to use, copy, modify, or redistribute the project beyond applicable law or a separate written agreement.
