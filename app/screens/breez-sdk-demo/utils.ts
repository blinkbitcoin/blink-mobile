type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export const stringifyWithBigInt = (value: JsonValue): string =>
  JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)

export const formatError = (error: Error | string): string =>
  `Error: ${error instanceof Error ? error.message : String(error)}`
