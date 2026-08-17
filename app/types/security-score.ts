export type SecuritySignalKey =
  | "cloudBackup"
  | "manualBackup"
  | "appLock"
  | "hideBalance"
  | "twoFactor"
  | "emailVerified"

export type SecuritySignalDescriptor = {
  key: SecuritySignalKey
  done: boolean
  // Backup rows stay tappable after completion so the flow can always be
  // re-run (#3828); the rest go inert once done.
  retriggerable: boolean
}

export type SecurityScoreLevel = "low" | "medium" | "high"

export type SecurityScore = {
  signals: SecuritySignalDescriptor[]
  done: number
  total: number
  level: SecurityScoreLevel
}
