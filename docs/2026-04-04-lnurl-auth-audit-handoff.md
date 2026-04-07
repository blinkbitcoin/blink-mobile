# LNURL-Auth Audit Handoff (for external LLM review)

## Scope

- Repository: `blink-mobile`
- Working branch: `feature/blink-lnurl-auth-audit-fixes`
- Base feature audited: `feature/blink-lnurl-auth`
- Goal: make LNURL-auth implementation safer and closer to LUD-04/LUD-05 behavior

## Files Changed

- `app/utils/lnurl-auth/lnurl-auth.ts`
- `app/utils/lnurl-auth/index.ts`
- `app/screens/lnurl-auth-screen/lnurl-auth-screen.tsx`
- `app/screens/send-bitcoin-screen/payment-destination/lnurl.ts`
- `app/screens/send-bitcoin-screen/scanning-qrcode-screen.tsx`
- `app/screens/redeem-lnurl-withdrawal-screen/redeem-bitcoin-detail-screen.tsx`
- `__tests__/utils/lnurl-auth.spec.ts` (new)
- `__tests__/payment-destination/lnurl.spec.ts`
- `docs/2026-04-04-lnurl-auth-audit-handoff.md` (this report)

## Main Fixes Applied

1. LUD-05 style key derivation and crypto hardening
- Replaced ad-hoc domain path derivation with LUD-05 style flow:
  - derive hashing key from `m/138'/0`
  - HMAC-SHA256 over normalized domain
  - first 16 bytes as four big-endian `uint32`
  - derive linking key at `m/138'/u32/u32/u32/u32`
- Added strict `k1` validation (must be 64 hex chars)
- Removed handcrafted DER encoding and used robust DER serialization path
- Added callback URL builder helper and callback domain/protocol assertions

2. UX/security flow for auth confirmation
- Removed auto-submit on screen mount
- Added explicit user actions:
  - Confirm/Approve
  - Cancel
  - Try Again after failure
- Added safer error mapping (no raw exception rendering to user)

3. Type-safety and parser resilience
- Added `isLnurlAuthAction` type guard
- Removed broad casts in LNURL auth parsing and QR routing
- Added fallback to `action: "login"` for unsupported action values
- Wrapped `getParams` lookup in parser so failures do not hard-crash destination handling

4. Cleanup
- Removed unused import in redeem LNURL withdraw screen

## Security and Correctness Decisions

- Callback URL must be `https:` except localhost/127.0.0.1 for local development.
- Callback host must match LNURL domain (normalized).
- Empty/invalid normalized domain is rejected before key derivation.
- URL-like malformed domain input is normalized safely (returns empty) rather than throwing in helpers.

## Tests Added/Updated

### New utility suite
- `__tests__/utils/lnurl-auth.spec.ts`
  - `k1` validation (non-hex + wrong length)
  - domain normalization (case, whitespace, trailing dot, URL+port, malformed input)
  - callback/domain match checks (valid match, mismatch, invalid callback URL, protocol enforcement)
  - callback URL query composition (`k1`, `sig`, `key` appended, existing params preserved)
  - DER signature shape and deterministic regression vector
  - deterministic linking-key derivation behavior with mocked BIP32 graph
  - empty normalized domain rejection

### Existing parser suite updates
- `__tests__/payment-destination/lnurl.spec.ts`
  - unsupported LNURL auth `action` defaults to `"login"`
  - parser still resolves LNURL pay when `getParams` throws

## Verification Commands and Results

Executed in worktree:

```bash
yarn test __tests__/utils/lnurl-auth.spec.ts __tests__/payment-destination/lnurl.spec.ts --watchAll=false
```

Result:
- Test Suites: 2 passed
- Tests: 29 passed

```bash
yarn tsc --noEmit
```

Result:
- Passed

```bash
yarn eslint:check
```

Result:
- Blocked by environment-level ESLint plugin resolution:
  - `eslint-plugin-react` not found from `/home/juanfx/blink-mobile` parent config

## Remaining Manual QA Suggested

- Scan LNURL-auth QR (`tag=login`) and verify screen shows consent state before signing
- Confirm `Cancel` causes no callback request
- Confirm `Confirm` performs signed callback request and handles:
  - `{ status: "OK" }`
  - `{ status: "ERROR", reason: "..." }`
- Confirm callback domain/protocol rejection path surfaces safe user-facing error

## Notes for External Auditor LLM

- Focus review on:
  - `app/utils/lnurl-auth/lnurl-auth.ts`
  - `app/screens/lnurl-auth-screen/lnurl-auth-screen.tsx`
  - `app/screens/send-bitcoin-screen/payment-destination/lnurl.ts`
  - `app/screens/send-bitcoin-screen/scanning-qrcode-screen.tsx`
- Check whether the specific LUD-05 derivation interpretation here matches Blink product requirements and interoperability expectations with target services.
