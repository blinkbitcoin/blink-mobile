export type SuccessActionComponentProps = {
  visible?: boolean
  title: string
  text?: string | null
  subText?: string
}

export enum SuccessActionTag {
  AES = "aes",
  MESSAGE = "message",
  URL = "url",
}
