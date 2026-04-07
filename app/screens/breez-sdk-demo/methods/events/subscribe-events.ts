import { SdkEvent_Tags } from "@breeztech/breez-sdk-spark-react-native"

import { getBreezClient } from "../../client"

const formatEvent = (event: { tag: string; inner?: object }): string => {
  const timestamp = new Date().toLocaleTimeString()
  const data = event.inner
    ? JSON.stringify(event.inner, (_k, v) =>
        typeof v === "bigint" ? v.toString() : v,
      )
    : ""
  return `[${timestamp}] ${event.tag}${data ? `: ${data}` : ""}`
}

export const subscribeEvents = async (
  onEvent: (log: string) => void,
): Promise<string> => {
  const sdk = await getBreezClient()

  const listenerId = await sdk.addEventListener({
    onEvent: async (event) => {
      if (event.tag === SdkEvent_Tags.Synced) {
        onEvent(formatEvent({ tag: "Synced" }))
      } else {
        onEvent(formatEvent({ tag: event.tag, inner: event.inner }))
      }
    },
  })

  return listenerId
}
