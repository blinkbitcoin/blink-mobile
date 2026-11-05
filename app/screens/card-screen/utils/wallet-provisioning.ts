export const WalletAddResult = {
  Added: "added",
  Cancelled: "cancelled",
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

export const addCardToWallet = async (_card: WalletCard): Promise<WalletAddResult> => {
  throw new Error("No device wallet can take the card yet")
}
