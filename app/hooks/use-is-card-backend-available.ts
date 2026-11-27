import { useAppConfig } from "./use-app-config"

/**
 * TODO(card): `cards` on ConsumerAccount only exists on the staging backend today, so
 * the card shows on staging only until the card service ships to every instance; then
 * drop this gate. Ref PR #3899.
 */
export const useIsCardBackendAvailable = (): boolean => {
  const { appConfig } = useAppConfig()
  return appConfig.galoyInstance.id === "Staging"
}
