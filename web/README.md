This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## AI runtime boundary

The server-side defaults are a 5-second Challenge deadline and an 8-second Report deadline. They are also shown in `.env.example` as `AI_CHALLENGE_TIMEOUT_MS=5000` and `AI_REPORT_TIMEOUT_MS=8000`.

The in-process AI budget is defense-in-depth only and is not a complete public cost boundary.

### Gate 0B production verification

Production domain: `https://connected-play.online`
Status: **PASS WITH WAIVER** for the Demo stage.

The Vercel Hobby Firewall rule `AI API Rate Limit` has been verified for `/api/challenge`: requests 1–16 within 60 seconds per IP were accepted, and request 17 onward returned HTTP `429 Too Many Requests`. This confirms the public WAF boundary for the Challenge endpoint.

### Gate 0B-S classroom recommendation

For a 50–60 person classroom burst, the Product Owner should manually update the Vercel WAF rule for `POST /api/challenge` to **180 requests / 60 seconds / source IP**, with the existing rate-limit action (HTTP `429` after the limit). This value covers one Challenge per round for 60 users. The repository does not claim this deployment change was applied; it must be verified in the Vercel dashboard and with a no-key/mock burst before classroom use.

One normal three-round run makes three Challenge requests and one Report request. This Gate 0B-S change adjusts both process budgets for that classroom shape; the cross-instance `/api/report` WAF waiver remains unchanged.

The in-process Challenge budget is correspondingly **180 requests per source key and 180 total per instance per 60 seconds**; the Report budget is **60 per source key and 60 total per instance per 60 seconds**. Both remain finite defense-in-depth guards, are not shared across Vercel instances, and must not be treated as a replacement for the WAF or a client-generated identity.

### Fresh Entry semantics

Any public experience link may append `?new=1`—for example a QR code, WeChat message, campus poster, or directly shared URL. On the first client mount, the app clears only that tab's `sessionStorage` training state, starts at Intro, and removes `new=1` with `history.replaceState`. A later refresh in the same tab therefore restores progress normally; links without `new=1` keep the existing session behavior. This is a browser-side entry marker and does not add a session ID, login, or server session.

`/api/report` is not described as WAF-protected. A 20-request test returned HTTP `405`, and a Challenge/Report cross-endpoint test did not demonstrate a shared rate-limit bucket. The current Vercel Hobby deployment therefore has no independently verified cross-instance WAF boundary for Report.

Waived Demo-stage risk: a malicious script may still consume a limited amount of provider balance through `/api/report`. Accepted mitigations are the existing process-level Report budget, timeout/abort protection on every AI request, deterministic fallback on failure, and the provider's limited prepaid balance.

Before broader public exposure, real team use, or a higher production-readiness target, close this waiver with an actually verified shared WAF, gateway, or equivalent cross-instance cost boundary for `/api/report`. This Gate does not upgrade the Vercel plan or add shared infrastructure.
