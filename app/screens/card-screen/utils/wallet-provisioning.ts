import { recordAppError, toError } from "@app/utils/error-reporting"

import { WalletAddResult, type WalletCard } from "../types"
import {
  fetchCardProvisioningData,
  isCardProvisioningAvailable,
} from "./card-provisioning-data"
import { deviceWalletFor } from "./device-wallets"
import { getMeaWalletSdk } from "./meawallet-sdk"

/**
 * Boundary with the device wallet (Apple Pay on iOS, Google Pay on Android), backed by
 * the MeaWallet SDK. The card is offered only when the build carries the SDK, the backend
 * can hand over what the wallet needs, and the wallet on this device can take this card.
 */
export const canAddCardToWallet = async (card: WalletCard): Promise<boolean> => {
  if (!isCardProvisioningAvailable) return false
  const sdk = await getMeaWalletSdk()
  if (!sdk) return false
  return deviceWalletFor(sdk).canAdd(card)
}

type PendingAdd = {
  cardId: string
  result: Promise<WalletAddResult>
}

/** The device shows one wallet sheet at a time, whichever screen asks for it: an add for
 *  the card already being added joins that one, and an add for another card is turned
 *  away as busy. */
let pendingAdd: PendingAdd | undefined

const provisionCard = async (card: WalletCard): Promise<WalletAddResult> => {
  const sdk = await getMeaWalletSdk()
  if (!sdk) throw new Error("This build carries no device wallet SDK")
  const data = await fetchCardProvisioningData(card.cardId)
  return deviceWalletFor(sdk).add(card, data)
}

export const addCardToWallet = (card: WalletCard): Promise<WalletAddResult> => {
  if (pendingAdd?.cardId === card.cardId) return pendingAdd.result
  if (pendingAdd) return Promise.resolve(WalletAddResult.Busy)

  /** Reported here, once per add, since every screen that joined it gets the same
   *  failure. */
  const result = provisionCard(card)
    .catch((err) => {
      recordAppError(toError(err))
      throw err
    })
    .finally(() => {
      pendingAdd = undefined
    })
  pendingAdd = { cardId: card.cardId, result }
  return result
}
