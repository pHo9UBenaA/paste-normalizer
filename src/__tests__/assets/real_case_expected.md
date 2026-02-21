## Summary

A Session Fixation vulnerability exists in Astro's session system. The `AstroSession` class accepts any value from the `astro-session` cookie as the session ID without validating its format or checking whether it was server-generated. An attacker who can plant a cookie in the victim's browser (subdomain injection, sibling-origin XSS, or network-level attack) can choose the session ID before the victim authenticates. After login, the victim's session data is stored under the attacker's chosen ID, allowing the attacker to read it with a trivial request carrying the same cookie value.

## Details

### Vulnerability Location



⏺ 完了しました。poc/reports.md を9つの個別ファイルに分割しました:

┌─────┬────────────────────────────────┬───────────┐
│  #  │          PoC フォルダ          │ ファイル  │
├─────┼────────────────────────────────┼───────────┤
│ 1   │ poc/xss-redirect-template/     │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 2   │ poc/session-fixation/          │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 3   │ poc/ssrf-infer-remote-size/    │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 4   │ poc/xff-spoofing/              │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 5   │ poc/ssrf-redirect-bypass/      │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 6   │ poc/error-overlay-info-leak/   │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 7   │ poc/action-body-size-dos/      │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 8   │ poc/server-island-enumeration/ │ REPORT.md │
├─────┼────────────────────────────────┼───────────┤
│ 9   │ poc/i18n-xff-bypass/           │ REPORT.md │
└─────┴────────────────────────────────┴───────────┘

元の poc/reports.md は削除済みです。各PoCフォルダに README.md（再現手順）と REPORT.md（セキュリティレポート）が揃っています。