export type SuccessActionComponentProps = {
  visible?: boolean
  icon?: "copy-paste" | "pencil"
  title?: string
  text?: string | null
}

export enum SuccessActionTag {
  AES = "aes",
  MESSAGE = "message",
  URL = "url",
}
