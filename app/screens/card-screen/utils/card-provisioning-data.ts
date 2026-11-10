import type { CardProvisioningData } from "../types"

/**
 * Rain hands the card secret to the issuer backend, and blink-card does not expose it to
 * the app yet. Until it does no card can be provisioned, so the wallet is never offered
 * and nothing asks for the data below.
 */
export const isCardProvisioningAvailable = false

export const fetchCardProvisioningData = async (
  _cardId: string,
): Promise<CardProvisioningData> => {
  throw new Error("The backend does not provide card provisioning data yet")
}
