// The picker is a TurboModule; importing it for real throws outside a native
// runtime, so any spec that reaches app/self-custodial/recovery-bundle/bundle-file
// (even transitively) needs this.
export const errorCodes = {
  OPERATION_CANCELED: "OPERATION_CANCELED",
  IN_PROGRESS: "ASYNC_OP_IN_PROGRESS",
  UNABLE_TO_OPEN_FILE_TYPE: "UNABLE_TO_OPEN_FILE_TYPE",
}

export const isErrorWithCode = (err) =>
  Boolean(err) && typeof err === "object" && typeof err.code === "string"

export const pick = jest.fn()
export const keepLocalCopy = jest.fn()
