import { CountryCode, parsePhoneNumber } from "libphonenumber-js/mobile"
import { useEffect, useMemo, useState } from "react"

import { useSettingsScreenQuery } from "@app/graphql/generated"
import { usePersistentStateContext } from "@app/store/persistent-state"
import {
  getFirstSeenCountryCode,
  withFirstSeenCountryCode,
} from "@app/store/persistent-state/first-seen-country"
import {
  logRegistrationCountryPersistDeferred,
  logRegistrationCountryPersisted,
} from "@app/utils/analytics"
import {
  detectAnonymizingIpCached,
  resolveIpCountryCodeCached,
} from "@app/utils/ip-country-lookup"
import { logError } from "@app/utils/log-error"

type RegistrationCountry = {
  countryCode: CountryCode | undefined
  loading: boolean
  trusted: boolean
}

type IpResolution = {
  countryCode: CountryCode | undefined
  settled: boolean
}

/**
 * The country the region restrictions are gated on (#3907): the account's
 * registration country, never the current IP. Priority:
 *
 * 1. Phone-number country — the registration country of a phone account.
 * 2. Persisted first-seen country — a no-phone (self-custodial) account has no
 *    registration, so the country resolved on first use is persisted and
 *    treated as its registration country from then on.
 * 3. One IP lookup to establish the first-seen country when neither exists.
 *    A failed lookup persists nothing, so a later session can retry.
 *
 * `trusted` is false only while the country is unknown; consumers must fail
 * open (no restriction) rather than act on an unknown country.
 */
export const useRegistrationCountry = (): RegistrationCountry => {
  const { persistentState, updateState } = usePersistentStateContext()
  const { data: settingsData, loading: settingsLoading } = useSettingsScreenQuery({
    fetchPolicy: "cache-first",
  })

  const persistedCountryCode = getFirstSeenCountryCode(persistentState) as
    | CountryCode
    | undefined
  const userPhone = settingsData?.me?.phone

  const phoneCountryCode = useMemo(() => {
    if (!userPhone) return undefined
    try {
      return parsePhoneNumber(userPhone)?.country
    } catch (err) {
      logError({
        scope: "registration-country",
        error: err,
        context: { source: "phone" },
      })
      return undefined
    }
  }, [userPhone])

  /**
   * The phone country is stronger evidence than a first-seen IP, so it also
   * refreshes the persisted value — the registration country then survives a
   * later switch to a no-phone (self-custodial) session.
   */
  useEffect(() => {
    if (!phoneCountryCode || phoneCountryCode === persistedCountryCode) return
    updateState((state) =>
      state ? withFirstSeenCountryCode(state, phoneCountryCode) : state,
    )
    logRegistrationCountryPersisted({ countryCode: phoneCountryCode, source: "phone" })
  }, [phoneCountryCode, persistedCountryCode, updateState])

  const shouldResolveIp = !settingsLoading && !phoneCountryCode && !persistedCountryCode

  const [ipResolution, setIpResolution] = useState<IpResolution>({
    countryCode: undefined,
    settled: false,
  })

  useEffect(() => {
    if (!shouldResolveIp) return undefined
    let active = true
    Promise.all([resolveIpCountryCodeCached(), detectAnonymizingIpCached()]).then(
      ([resolved, isAnonymizing]) => {
        if (!active) return
        setIpResolution({ countryCode: resolved, settled: true })
        if (!resolved) return
        /**
         * A VPN/proxy exit country must never be pinned as the wallet's
         * registration country (#3907): behind a flagged anonymizer the
         * resolved country is used for this session only and persisting is
         * retried on a later session. Only a confirmed flag defers — an
         * external detector's availability must not gate registration.
         */
        if (isAnonymizing === true) {
          logRegistrationCountryPersistDeferred({ countryCode: resolved })
          return
        }
        updateState((state) =>
          state && !getFirstSeenCountryCode(state)
            ? withFirstSeenCountryCode(state, resolved)
            : state,
        )
        logRegistrationCountryPersisted({ countryCode: resolved, source: "ip" })
      },
    )
    return () => {
      active = false
    }
  }, [shouldResolveIp, updateState])

  const countryCode = phoneCountryCode ?? persistedCountryCode ?? ipResolution.countryCode
  const loading =
    !countryCode && (settingsLoading || (shouldResolveIp && !ipResolution.settled))

  return { countryCode, loading, trusted: Boolean(countryCode) }
}
