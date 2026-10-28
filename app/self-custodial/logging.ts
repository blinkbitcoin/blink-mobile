import {
  RecordAppErrorOptions,
  logBreadcrumb,
  recordAppError,
} from "@app/utils/error-reporting"

export const recordErrorOnce = (
  dedupKey: string,
  error: Error,
  options?: Pick<RecordAppErrorOptions, "expected">,
): void => recordAppError(error, { dedupKey, ...options })

export const SdkLogLevel = {
  Debug: "debug",
  Info: "info",
  Warn: "warn",
  Error: "error",
} as const

export type SdkLogLevel = (typeof SdkLogLevel)[keyof typeof SdkLogLevel]

const LOG_PREFIX = "[SparkSDK]"

const sdkLogLevelMap: Record<string, SdkLogLevel> = {
  debug: SdkLogLevel.Debug,
  info: SdkLogLevel.Info,
  warn: SdkLogLevel.Warn,
  error: SdkLogLevel.Error,
}

const toSdkLogLevel = (level: string): SdkLogLevel =>
  sdkLogLevelMap[level.toLowerCase()] ?? SdkLogLevel.Info

// SDK retry loops repeat the same line with varying counters/ports; normalize digits
// so each distinct message shape records at most one non-fatal per session.
const sdkErrorDedupKey = (msg: string): string => msg.replace(/\d+/g, "#").slice(0, 200)

/**
 * What a line keeps on its way to Crashlytics. The SDK's Debug output names its data
 * (`amount: 21`, `invoice: "lnbc…"`, `description: Some("Pay to …")`), so a struct
 * field's string value and an amount-like field's number are dropped wholesale, and the
 * identifiers that also turn up unlabeled (invoices, addresses, pubkeys, payment ids,
 * URLs whose paths carry pubkeys and whose queries carry amounts and comments) are
 * masked wherever they appear. Error text in tuple form (`NetworkError("…")`) is not a
 * field and survives, minus any identifier inside it.
 */
const SDK_LOG_REDACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(https?|wss?):\/\/([^/\s"'),?#]+)[^\s"'),]*/gi, "$1://$2/…"],
  [/(\b\w+: (?:Some\()?)"(?:[^"\\]|\\.)*"/g, '$1"…"'],
  [/\[\s*\d{1,3}(?:\s*,\s*\d{1,3}){7,}\s*\]/g, "[…]"],
  [/\bln(?:bc|tb|bcrt|tbs|sb)[0-9a-z]{20,}/gi, "<invoice>"],
  [/\blnurl[0-9a-z]{20,}/gi, "<lnurl>"],
  [/\b(?:bc|tb|bcrt|sp|spt|sprt|spark|sparkrt|sparkt)1[0-9a-z]{20,}/gi, "<address>"],
  [/\b[123mn][1-9A-HJ-NP-Za-km-z]{25,39}\b/g, "<address>"],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "<address>"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>"],
  [/\b[0-9a-f]{32,}\b/gi, "<hex>"],
  [/\b(\w*(?:amount|fee|sat|balance)\w*)(\s*[:=]\s*)(Some\()?\d+/gi, "$1$2$3#"],
]

export const scrubSdkLogLine = (line: string): string =>
  SDK_LOG_REDACTIONS.reduce(
    (scrubbed, [pattern, replacement]) => scrubbed.replace(pattern, replacement),
    line,
  )

/**
 * Info stays in the console: the SDK logs every emitted event and synced payment at
 * info, each with the whole Payment, so it is the payment record rather than a
 * breadcrumb. Warn and error reach Crashlytics scrubbed, and only while crash
 * reporting is open (see `setCrashReportingOpen`). An error is classified on its raw
 * text, which still says whether it was a connectivity failure.
 */
const logDispatch: Record<SdkLogLevel, (msg: string) => void> = {
  [SdkLogLevel.Debug]: (msg) => console.debug(msg),
  [SdkLogLevel.Info]: (msg) => console.debug(msg),
  [SdkLogLevel.Warn]: (msg) => {
    console.warn(msg)
    logBreadcrumb(scrubSdkLogLine(msg))
  },
  [SdkLogLevel.Error]: (msg) => {
    console.error(msg)
    const scrubbed = scrubSdkLogLine(msg)
    recordAppError(new Error(scrubbed), {
      dedupKey: sdkErrorDedupKey(scrubbed),
      classifyText: msg,
    })
  },
}

export const logSdkEvent = (level: SdkLogLevel, message: string): void => {
  logDispatch[level](`${LOG_PREFIX} ${message}`)
}

type LogEntry = {
  level: string
  line: string
}

const SUPPRESSED_MESSAGES = ["Received empty event"]

export const createSdkLogListener = () => ({
  log: (entry: LogEntry) => {
    if (SUPPRESSED_MESSAGES.some((m) => entry.line.includes(m))) return
    logSdkEvent(toSdkLogLevel(entry.level), entry.line)
  },
})
