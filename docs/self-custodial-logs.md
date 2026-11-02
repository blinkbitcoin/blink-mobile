# Self-Custodial Wallet Logs

How a self-custodial user gets the Breez SDK's log to support, and how to read it.

## Where users find it

**Settings → Advanced → Download logs**, next to *Export CSV*. The row shows whenever
the active account is self-custodial, in Incognito and Enhanced mode alike. It is not
in the Contact us modal, which Incognito disables.

Tapping it shows a short disclosure, then the OS share sheet. The user chooses where
the file goes (mail, a chat app, Files, Drive). The app never uploads it.

**The file covers every self-custodial wallet used on the device, whichever one is
active.** The SDK log is shared by all of them, and its lines don't say which wallet wrote
them, so switching wallets doesn't select or filter anything. The disclosure says so, and
the header gives the number of self-custodial wallets on the device.

## What is on the device

| Path (app cache directory) | What |
|---|---|
| `breez-sdk-logs/sdk.log` | Written by the SDK itself (`initLogging(logDir, …)`), appended for the whole process |
| `breez-sdk-logs/sdk.log.1` | The previous generation |
| `breez-sdk-log-exports/blink-wallet-logs-<yyyyMMdd-HHmm>.txt` | The last export, removed when the next one is built |

- `sdk.log` is moved to `sdk.log.1` at launch once it passes 2 MB, so at most two
  files exist. The SDK holds the file open while the app runs, so launch is the only
  moment it can be rotated.
- With the app open and idle the log grows by about 0.7 MB an hour (measured on
  0.26.1 and 0.27.1); it does not grow while the app is in the background. Two files hold
  roughly the last five hours of foreground use.
- **Deleting any self-custodial wallet resets the whole log.** Lines don't say which
  wallet wrote them, so the only safe deletion is all of it. Remaining wallets lose their
  log history up to that point. Both ways a wallet leaves the device do this, since both
  go through `eraseWalletFromDevice`: deleting it from settings, and the forgotten-PIN
  escape that removes every wallet. The SDK holds `sdk.log` open for the rest of the process
  and can't reopen it, so the reset runs in steps that hold wherever the process stops:
  - `sdk.log.reset` is written *before* the wallet's backup phrase is removed. Only its
    existence counts, so a write torn by a crash can't make it keep anything.
  - With no logger holding the file, everything (logs, exports, flag) goes at once.
  - With the logger running, the export folder and `sdk.log.1` go at once, and `sdk.log`
    is cut off in memory: for the rest of the session exports read only what it gains
    after the reset, so a wallet restored or created in that session exports at once.
  - Deletion first retires the wallet's storage directory (`retireSdkStorage`), so
    `initSdk` refuses it from then on, both on entry and again right before `connect`.
    `useSdkLifecycle` also gives up before connecting once its run is cancelled. Only
    then does the cut wait until no SDK instance of the wallet is connected or still
    connecting (`waitForSdkIdle`). A connect already in flight finishes before the cut,
    and no new one can start after it. If the wait takes longer than 15 s, exports read
    nothing more this session.
  - The cut only ever moves later. Once a reset has had to read nothing more, a later
    ordinary reset in the same session can't reopen what a still-running SDK writes.
  - The next launch removes the logs and then the flag, before the logger opens the
    file, whether or not a wallet connects again (`LaunchCleanupMount`). The logger waits
    for it. If it can't finish, the logger runs without a file and the flag stays for the
    launch after.
  - The wallet's SDK storage directory, which holds its payment history too, gets the same
    treatment. A `<accountId>.removing` marker is written beside it before the backup phrase
    goes. The directory is removed at once if the SDK went idle, or once it does, and any
    leftover is swept at the next launch (`finishPendingStorageRemovals`, which `initSdk`
    awaits before connecting).
  - If the flag can't be written, the logs are removed at once. If that fails too, the
    reset rejects and the wallet deletion stops before the backup phrase is touched:
    a wallet is never deleted with its history left exportable.
  - Starting the logger, a reset and building an export run one at a time under one
    lock, so an export can't write back logs a reset just removed, and a reset can't
    remove the file a starting logger just opened. Sharing happens outside the lock,
    because a share sheet can stay open indefinitely.

  `app/self-custodial/diagnostics/sdk-log-files.ts` owns this whole lifecycle;
  `__tests__/self-custodial/diagnostics/log-lifecycle.spec.ts` runs it end to end.
- Every self-custodial wallet in the process writes to the same `sdk.log`, and lines
  do not say which wallet emitted them.
- An SDK that rejects its config writes nothing: `connect` validates before it logs a
  line. If a user whose wallet will not open gets "There are no logs to share yet",
  suspect the config. For example, 0.27.1 refuses a `SPARK_TOKEN_IDENTIFIER` that is
  not a bech32m token ID for the network, with `SdkError.InvalidInput`.

## Reading an export

The file starts with a header, then each log file oldest first under a marker:

```
Blink wallet logs
Exported: 2026-10-28T15:03:06.930Z (device time UTC+02:00)
App: 2.2.328.785
OS: android 36
Breez SDK: 0.27.1
Network: mainnet
Account mode: enhanced
Self-custodial wallets on this device: 1

--- sdk.log.1 ---
…
--- sdk.log ---
2026-10-28T15:01:31.401272Z  INFO breez_sdk_spark::sdk_builder: 499: Building sdk with user agent: breez-sdk-spark/0.27.1
```

Each SDK line is `<UTC timestamp> <LEVEL> <target>: <source line>: <message>`. The
header's device offset converts what the user reports in local time.

Worth grepping for:

- ` ERROR ` and ` WARN `: failures, with the crate path that raised them.
- `Synced payment:` and `Emitting payment event:`: the full payment as the SDK saw it.
- `sync_wallet_internal` and `Failed to sync`: sync and LNURL metadata failures.
- `Making POST request to` / `Making GET request to`: every HTTP call, with its URL.
- `claim` / `deposit`: on-chain deposit claims.

## What the file contains

Treat a shared file as **personal financial data**. How long support keeps a shared
file, and where, is not decided yet.

It holds:

- payment history: amounts, invoices, destinations, Lightning addresses, txids;
- the wallet's identity public key (the *Wallet identifier* on the account screen), in
  debug lines such as LNURL request URLs (`/lnurlpay/<pubkey>`) and
  `Balance updated for identity <pubkey>`.

It does not contain the backup phrase, keys or the Breez API key (checked against a real
log on 0.26.1 and 0.27.1), and preimages are printed as `<redacted>` by the SDK since
0.26.1; the export redacts any that slip through as well. The header carries no
pubkey, account ID or Lightning address.

From 0.27.1 the SDK also passes the identity public key to the app's JS log listener on
every line (`LogEntry.instanceId`). The listener reads only the level and the line, and
only warn and error lines reach Crashlytics, scrubbed (`scrubSdkLogLine`);
`__tests__/self-custodial/logging.spec.ts` pins that.

## Code

| Piece | File |
|---|---|
| Log directory, rotation, deletion | `app/self-custodial/diagnostics/sdk-log-files.ts` |
| Logger start-up (once per process, retried without a file) | `app/self-custodial/bridge/lifecycle.ts` |
| Export file and header | `app/self-custodial/diagnostics/export-sdk-logs.ts`, `log-export-header.ts`, `build-sdk-log-export.ts` |
| Share | `app/utils/share-file.ts`, `app/self-custodial/hooks/use-export-sdk-logs.ts` |
| Settings row and disclosure | `app/screens/settings-screen/settings/advanced-export-logs.tsx` |
