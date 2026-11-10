import type { CardProvisioningData } from "../types"

type FetchCardProvisioningData = (cardId: string) => Promise<CardProvisioningData>

/**
 * How the app gets what a device wallet needs for a card, or null while it cannot: Rain
 * hands the card secret to the issuer backend, and blink-card does not expose it to the
 * app yet. While it is null the wallet is never offered, so wiring the request here is the
 * one change that turns the feature on.
 */
export const fetchCardProvisioningData: FetchCardProvisioningData | null = null
