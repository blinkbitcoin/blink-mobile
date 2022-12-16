import Clipboard from "@react-native-clipboard/clipboard"
import { ApolloClient } from "@apollo/client"

import { validPayment } from "./parsing"
import {
  LAST_CLIPBOARD_PAYMENT,
  modalClipboardVisibleVar,
} from "../graphql/client-only-query"
import { cache } from "../graphql/cache"
import { INetwork } from "../types/network"

type ShowModalClipboardIfValidPaymentInput = {
  client: ApolloClient<unknown>
  network: INetwork
  myPubKey: string
  username: string
}

export const showModalClipboardIfValidPayment = async (
  // eslint-disable-next-line @typescript-eslint/ban-types
  { network, myPubKey, username }: ShowModalClipboardIfValidPaymentInput,
): Promise<void> => {
  if(!Clipboard.hasString()) {
    return 
  }
  const clipboard = await Clipboard.getString()

  const data = cache.readQuery<{ lastClipboardPayment?: string }, never>({
    query: LAST_CLIPBOARD_PAYMENT,
  })

  if (clipboard === data?.lastClipboardPayment) {
    return
  }

  const { valid } = validPayment(clipboard, network, myPubKey, username)
  if (!valid) {
    return
  }

  modalClipboardVisibleVar(true)
}
