import { LNURLPaySuccessAction } from "lnurl-pay"

export type SuccessActionComponentProps = {
  successAction?: LNURLPaySuccessAction
  preimage?: string
}

export enum SuccessActionTag {
  AES = "aes",
  MESSAGE = "message",
  URL = "url",
}
