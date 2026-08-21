import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useFeatureFlags, useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { isBlockedCountry, useIpCountryLookup } from "@app/hooks/use-device-location"
import { RestrictedRegionScreen } from "@app/custodial/components/restricted-region-screen"
import { bootSplashGate } from "@app/navigation/boot-splash-gate"
import { RestrictedRegionModal } from "@app/self-custodial/components/restricted-region-modal"
import { AccountType } from "@app/types/wallet"

type RestrictedRegionContextType = {
  isRestrictedRegion: boolean
  /** True while the session verdict may still flip (registry, IP lookup or remote
   *  config in flight). Surfaces that present their own modals wait on this so a
   *  late restriction modal cannot stack on top of them. */
  isRestrictedRegionEvaluationPending: boolean
  /** Surfaces that coordinate concurrent modals (e.g. Home) read this. */
  isRestrictedRegionModalVisible: boolean
  presentRestrictedRegionModal: () => void
}

const RestrictedRegionContext = createContext<RestrictedRegionContextType>({
  isRestrictedRegion: false,
  isRestrictedRegionEvaluationPending: false,
  isRestrictedRegionModalVisible: false,
  presentRestrictedRegionModal: () => {},
})

export const useRestrictedRegion = (): RestrictedRegionContextType =>
  useContext(RestrictedRegionContext)

/** NFR-1 bound for the custodial cold-start splash hold: past this the app is
 *  revealed and a late restricted verdict surfaces over it instead of before it. */
const RESTRICTED_REGION_HOLD_CAP_MS = 2000

type RestrictedRegionEvaluation = {
  isRestrictedRegion: boolean
  isEvaluationPending: boolean
  accountType: AccountType | undefined
}

/** Sanctions ride the live session IP, never the phone country. In Anon no lookup runs,
 *  so nothing resolves and nothing restricts; without an account there is nothing to
 *  block (creation has its own gate). The pending flag spans every async input of the
 *  verdict — registry hydration, the IP lookup and the remote-config fetch — so no
 *  consumer can mistake a provisional verdict for a settled one. */
const useEvaluateRestrictedRegion = (): RestrictedRegionEvaluation => {
  const { activeAccount, loading: isRegistryHydrating } = useAccountRegistry()
  const accountType = activeAccount?.type
  const { custodialCreationBlockedCountries, selfCustodialCreationBlockedCountries } =
    useRemoteConfig()
  const { remoteConfigReady } = useFeatureFlags()
  const { countryCode: ipCountryCode, isSettled } = useIpCountryLookup(
    accountType !== undefined,
  )

  if (accountType === undefined) {
    return {
      isRestrictedRegion: false,
      isEvaluationPending: isRegistryHydrating,
      accountType,
    }
  }

  const blockedCountries =
    accountType === AccountType.SelfCustodial
      ? selfCustodialCreationBlockedCountries
      : custodialCreationBlockedCountries

  const isEvaluationPending = isRegistryHydrating || !isSettled || !remoteConfigReady

  return {
    isRestrictedRegion: isBlockedCountry(ipCountryCode, blockedCountries),
    isEvaluationPending,
    accountType,
  }
}

/** Hosts the sanctions surfaces: the custodial one blocks the whole session, since
 *  every custodial function is Blink-served; the self-custodial one presents once per
 *  restricted session and leaves the local wallet usable. */
export const RestrictedRegionProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { isRestrictedRegion, isEvaluationPending, accountType } =
    useEvaluateRestrictedRegion()
  const isCustodialAccount = accountType === AccountType.Custodial
  const isCustodialBlock = isRestrictedRegion && isCustodialAccount

  /**
   * Cold-start splash hold, custodial only. A restricted custodial verdict replaces
   * the whole session with the full-screen block, so the splash must not reveal Home
   * before that verdict settles; the hold also spans the window where the account
   * type is still unknown, since it may turn out custodial. The self-custodial
   * restriction is a dismissible notice over a usable wallet, so it never defers the
   * reveal. Children stay mounted throughout — only the reveal is gated — and the
   * gate is monotonic with its own cap, so a remounted or crashed provider can
   * neither re-blank the app nor leave the splash up forever.
   */
  const isKnownSelfCustodial = accountType === AccountType.SelfCustodial
  const shouldHoldSplash = isEvaluationPending && !isKnownSelfCustodial

  useEffect(() => {
    if (shouldHoldSplash) {
      bootSplashGate.hold(RESTRICTED_REGION_HOLD_CAP_MS)
      return
    }
    bootSplashGate.release()
  }, [shouldHoldSplash])

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
      isRestrictedRegionEvaluationPending: isEvaluationPending,
      isRestrictedRegionModalVisible: isModalVisible,
      presentRestrictedRegionModal,
    }),
    [
      isRestrictedRegion,
      isEvaluationPending,
      isModalVisible,
      presentRestrictedRegionModal,
    ],
  )

  return (
    <RestrictedRegionContext.Provider value={contextValue}>
      {children}
      {isCustodialBlock && <RestrictedRegionScreen />}
      {/** Mounted for the whole restricted session so a user dismiss keeps its exit
       *   animation (a clearing region unmounts it outright); off the tree otherwise. */}
      {isRestrictedRegion && !isCustodialBlock && (
        <RestrictedRegionModal isVisible={isModalVisible} onDismiss={dismissModal} />
      )}
    </RestrictedRegionContext.Provider>
  )
}
