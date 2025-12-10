export type SuccessActionComponentProps = {
  visible?: boolean
  title: string
  text?: string | null
  subValue?: string
}

export enum SuccessActionTag {
  AES = "aes",
  MESSAGE = "message",
  URL = "url",
}
