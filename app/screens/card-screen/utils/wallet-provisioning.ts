import { recordAppError, toError } from "@app/utils/error-reporting"

export const WalletAddResult = {
  Added: "added",
  Cancelled: "cancelled",
  Busy: "busy",
} as const

export type WalletAddResult = (typeof WalletAddResult)[keyof typeof WalletAddResult]

export type WalletCard = {
  cardId: string
  lastFour: string
}

/**
 * Boundary with the device wallet (Apple Pay, Google Pay and Samsung Pay). The
 * MeaWallet SDK that backs it is not installed yet (blink-wip#427), so until it
 * lands no wallet can take the card and the add to wallet button stays hidden.
 */
export const canAddCardToWallet = async (_card: WalletCard): Promise<boolean> => false

type PendingAdd = {
  cardId: string
  result: Promise<WalletAddResult>
}

/** The device shows one wallet sheet at a time, whichever screen asks for it: an add for
 *  the card already being added joins that one, and an add for another card is turned
 *  away as busy. */
let pendingAdd: PendingAdd | undefined

const provisionCard = async (_card: WalletCard): Promise<WalletAddResult> => {
  throw new Error("No device wallet can take the card yet")
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
