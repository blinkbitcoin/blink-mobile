import { CountryCode, parsePhoneNumber } from "libphonenumber-js/mobile"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"

import { useApolloClient } from "@apollo/client"
import { updateCountryCode } from "@app/graphql/client-only-query"
import { useCountryCodeQuery, useSettingsScreenQuery } from "@app/graphql/generated"
import {
  getIpCountryLookupGeneration,
  resolveIpCountryCodeCached,
  subscribeToIpCountryLookup,
} from "@app/utils/ip-country-lookup"
import { logError } from "@app/utils/log-error"

import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"

const DEFAULT_COUNTRY_CODE: CountryCode = "SV"

export const LocationSource = {
  Phone: "phone",
  Ip: "ip",
} as const

export type LocationSource = (typeof LocationSource)[keyof typeof LocationSource]

export const isBlockedCountry = (
  countryCode: string | undefined,
  blockedCountries: string[],
): boolean => Boolean(countryCode && blockedCountries.includes(countryCode.toUpperCase()))

type DeviceLocation = {
  countryCode: CountryCode | undefined
  loading: boolean
  detectionFailed: boolean
  source: LocationSource | undefined
}

const NO_LOCATION: DeviceLocation = {
  countryCode: undefined,
  loading: false,
  detectionFailed: false,
  source: undefined,
}

type DeviceLocationOptions = {
  /** Custodial flows (phone auth) sit outside the self-custodial Anon rule and keep
   *  detecting normally even while an Anon account is the active one. */
  isCustodialFlow?: boolean
}

/** Anon Mode never resolves a location: the guard lives here so no consumer can leak a lookup. */
const useDeviceLocation = ({
  isCustodialFlow = false,
}: DeviceLocationOptions = {}): DeviceLocation => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const isDetectionBlocked = isAnonMode && !isCustodialFlow
  const client = useApolloClient()
  const { data, error } = useCountryCodeQuery({ skip: isDetectionBlocked })
  const { data: settingsData } = useSettingsScreenQuery({
    skip: isDetectionBlocked,
    fetchPolicy: "cache-first",
  })

  const [loading, setLoading] = useState(true)
  const [countryCode, setCountryCode] = useState<CountryCode | undefined>()
  const [detectionFailed, setDetectionFailed] = useState(false)
  const [source, setSource] = useState<LocationSource | undefined>()

  /** Re-read at each session start so the IP branch resolves against the connection the
   *  session actually runs on, rather than the one the screen mounted under. */
  const lookupGeneration = useSyncExternalStore(
    subscribeToIpCountryLookup,
    getIpCountryLookupGeneration,
  )

  const userPhone = settingsData?.me?.phone

  /** Entering Anon discards prior results; leaving re-arms loading for the fresh resolve. */
  useEffect(() => {
    if (isDetectionBlocked) {
      setCountryCode(undefined)
      setSource(undefined)
      setDetectionFailed(false)
      setLoading(false)
      return
    }
    setLoading(true)
  }, [isDetectionBlocked])

  useEffect(() => {
    if (isDetectionBlocked || !userPhone) return
    setSource(LocationSource.Phone)
    try {
      const parsed = parsePhoneNumber(userPhone)
      if (!parsed?.country) {
        setCountryCode(DEFAULT_COUNTRY_CODE)
        setDetectionFailed(true)
        setLoading(false)
        logError({
          scope: "device-location",
          error: new Error("phone-parse returned no country, using fallback"),
          context: { source: "phone" },
        })
        return
      }
      setCountryCode(parsed.country)
      setDetectionFailed(false)
      updateCountryCode(client, parsed.country)
    } catch (err) {
      setCountryCode(DEFAULT_COUNTRY_CODE)
      setDetectionFailed(true)
      logError({
        scope: "device-location",
        error: err,
        context: { source: "phone" },
      })
    }
    setLoading(false)
  }, [isDetectionBlocked, userPhone, client])

  useEffect(() => {
    if (isDetectionBlocked) return
    if (error && !userPhone) {
      setCountryCode(DEFAULT_COUNTRY_CODE)
      setSource(LocationSource.Ip)
      setDetectionFailed(true)
      setLoading(false)
      logError({
        scope: "device-location",
        error,
        context: { source: "country-code-query" },
      })
    }
  }, [isDetectionBlocked, error, userPhone])

  useEffect(() => {
    if (isDetectionBlocked || !data || userPhone) return
    setSource(LocationSource.Ip)
    /** A lookup still in flight when Anon starts must not write state or the cache. */
    let active = true
    const getLocation = async () => {
      const cached = data.countryCode as CountryCode | undefined
      const ipCountryCode = await resolveIpCountryCodeCached()
      if (!active) return
      if (ipCountryCode) {
        setCountryCode(ipCountryCode)
        setDetectionFailed(false)
        updateCountryCode(client, ipCountryCode)
      } else {
        setCountryCode(cached ?? DEFAULT_COUNTRY_CODE)
        setDetectionFailed(!cached)
      }
      setLoading(false)
    }
    getLocation()
    return () => {
      active = false
    }
  }, [isDetectionBlocked, data, client, userPhone, lookupGeneration])

  if (isDetectionBlocked) return NO_LOCATION

  return {
    countryCode,
    loading,
    detectionFailed,
    source,
  }
}

export const usePhoneCountryCode = (): CountryCode | undefined => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const { data } = useSettingsScreenQuery({
    skip: isAnonMode,
    fetchPolicy: "cache-first",
  })
  const phone = isAnonMode ? undefined : data?.me?.phone

  return useMemo(() => {
    if (!phone) return undefined
    try {
      return parsePhoneNumber(phone)?.country
    } catch {
      return undefined
    }
  }, [phone])
}

type IpCountryLookup = {
  countryCode: CountryCode | undefined
  /** True once waiting is pointless: the lookup finished (with or without a country) or
   *  it is disabled and will never run. Gates that hold UI on the lookup read this. */
  isSettled: boolean
}

export const useIpCountryLookup = (enabled: boolean): IpCountryLookup => {
  const { isAnonMode } = useSelfCustodialAccountMode()
  const isLookupEnabled = enabled && !isAnonMode
  const [ipCountryCode, setIpCountryCode] = useState<CountryCode | undefined>()
  const [hasLookupFinished, setHasLookupFinished] = useState(false)

  /** A session start drops the shared lookup; re-reading the generation here is what makes
   *  an already-mounted consumer resolve again rather than keep last session's country. */
  const lookupGeneration = useSyncExternalStore(
    subscribeToIpCountryLookup,
    getIpCountryLookupGeneration,
  )

  useEffect(() => {
    if (!isLookupEnabled) {
      setIpCountryCode(undefined)
      setHasLookupFinished(false)
      return undefined
    }
    let active = true
    setHasLookupFinished(false)
    resolveIpCountryCodeCached().then((code) => {
      if (!active) return
      /** Written even when the lookup comes back empty. A re-lookup that fails has to report
       *  unresolved: holding the previous answer would settle this session on the country the
       *  last connection resolved, which is the cross-session latch the generation exists to
       *  drop. */
      setIpCountryCode(code)
      setHasLookupFinished(true)
    })
    return () => {
      active = false
    }
  }, [isLookupEnabled, lookupGeneration])

  const isLookupSettled = !isLookupEnabled || hasLookupFinished

  /** Both fields derive from `isLookupEnabled` in the same render: the effect clears
   *  the stored country a commit later, and returning it in between would leak a
   *  stale country as a settled verdict on the render where the lookup disables
   *  (e.g. entering Anon right after a resolve). */
  return {
    countryCode: isLookupEnabled ? ipCountryCode : undefined,
    isSettled: isLookupSettled,
  }
}

export const useIpCountryCode = (enabled: boolean): CountryCode | undefined =>
  useIpCountryLookup(enabled).countryCode

export default useDeviceLocation
