import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { isBlockedCountry, useIpCountryCode } from "@app/hooks/use-device-location"
import { AccountType } from "@app/types/wallet"

import { RestrictedRegionModal } from "./restricted-region-modal"
import { RestrictedRegionScreen } from "./restricted-region-screen"

type RestrictedRegionContextType = {
  isRestrictedRegion: boolean
  /** Surfaces that coordinate concurrent modals (e.g. Home) read this. */
  isRestrictedRegionModalVisible: boolean
  presentRestrictedRegionModal: () => void
}

const RestrictedRegionContext = createContext<RestrictedRegionContextType>({
  isRestrictedRegion: false,
  isRestrictedRegionModalVisible: false,
  presentRestrictedRegionModal: () => {},
})

export const useRestrictedRegion = (): RestrictedRegionContextType =>
  useContext(RestrictedRegionContext)

/** Sanctions ride the live session IP, never the phone country. In Anon no lookup runs,
 *  so nothing resolves and nothing restricts; without an account there is nothing to
 *  block (creation has its own gate). */
const useEvaluateRestrictedRegion = (accountType: AccountType | undefined): boolean => {
  const { custodialCreationBlockedCountries, selfCustodialCreationBlockedCountries } =
    useRemoteConfig()
  const ipCountryCode = useIpCountryCode(accountType !== undefined)

  if (accountType === undefined) return false

  const blockedCountries =
    accountType === AccountType.SelfCustodial
      ? selfCustodialCreationBlockedCountries
      : custodialCreationBlockedCountries

  return isBlockedCountry(ipCountryCode, blockedCountries)
}

/** Hosts the sanctions surfaces: the custodial variant blocks the whole session, since
 *  every custodial function is Blink-served; the non-custodial one presents once per
 *  restricted session and leaves the local wallet usable. */
export const RestrictedRegionProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { activeAccount } = useAccountRegistry()
  const isRestrictedRegion = useEvaluateRestrictedRegion(activeAccount?.type)
  const isCustodialBlock =
    isRestrictedRegion && activeAccount?.type === AccountType.Custodial

  const [isModalVisible, setIsModalVisible] = useState(false)
  const hasPresentedRef = useRef(false)

  /** Presents once per restricted session; a region that clears closes any stale modal
   *  and re-arms the next restricted one. */
  useEffect(() => {
    if (!isRestrictedRegion) {
      hasPresentedRef.current = false
      setIsModalVisible(false)
      return
    }
    if (isCustodialBlock || hasPresentedRef.current) return
    hasPresentedRef.current = true
    setIsModalVisible(true)
  }, [isRestrictedRegion, isCustodialBlock])

  const presentRestrictedRegionModal = useCallback(() => setIsModalVisible(true), [])
  const dismissModal = useCallback(() => setIsModalVisible(false), [])

  const contextValue = useMemo(
    () => ({
      isRestrictedRegion,
      isRestrictedRegionModalVisible: isModalVisible,
      presentRestrictedRegionModal,
    }),
    [isRestrictedRegion, isModalVisible, presentRestrictedRegionModal],
  )

  return (
    <RestrictedRegionContext.Provider value={contextValue}>
      {children}
      {isCustodialBlock && <RestrictedRegionScreen />}
      {/** Mounted for the whole restricted session (dismiss keeps its exit animation),
       *   and off the tree entirely for everyone else. */}
      {isRestrictedRegion && !isCustodialBlock && (
        <RestrictedRegionModal isVisible={isModalVisible} onDismiss={dismissModal} />
      )}
    </RestrictedRegionContext.Provider>
  )
}
