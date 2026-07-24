import { useAppConfig } from "@app/hooks"

import { isCardUsable } from "../utils/card-display"
import { useCardData } from "./use-card-data"

/**
 * TODO(card): `cards` on ConsumerAccount only exists on the staging backend
 * today, so the home card row stays gated to staging until the card service
 * ships to every instance; then drop the instance check and query
 * unconditionally. Ref PR #3899.
 */
export const useHomeCard = () => {
  const {
    appConfig: {
      galoyInstance: { id: galoyInstanceId },
    },
  } = useAppConfig()

  const isCardBackendAvailable = galoyInstanceId === "Staging"
  const { card } = useCardData({ skip: !isCardBackendAvailable })

  return {
    hasCard: card !== undefined && isCardUsable(card.status),
    cardLastFour: card?.lastFour,
  }
}
