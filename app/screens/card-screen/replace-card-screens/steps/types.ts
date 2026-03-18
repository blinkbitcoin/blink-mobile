export const Issue = {
  Lost: "lost",
  Stolen: "stolen",
  Damaged: "damaged",
} as const

export type IssueType = (typeof Issue)[keyof typeof Issue]
