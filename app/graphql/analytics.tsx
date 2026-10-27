import { useEffect } from "react"

import { gql } from "@apollo/client"
import { useAnalyticsQuery } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { resolveActiveSelfCustodialId } from "@app/store/persistent-state/active-self-custodial-account"
import analytics from "@react-native-firebase/analytics"

import { useIsAuthed } from "./is-authed-context"
import { useLevel } from "./level-context"

gql`
  query analytics {
    me {
      username
      id
    }
    globals {
      network
    }
  }
`

export const AnalyticsContainer = () => {
  const isAuthed = useIsAuthed()
  const level = useLevel()
  const { persistentState } = usePersistentStateContext()
  const {
    appConfig: {
      galoyInstance: { name: galoyInstanceName },
    },
  } = useAppConfig()

  const { data } = useAnalyticsQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
  })

  /** The custodial account id identifies GA4 only while custodial is active: a
   *  self-custodial session reports under the per-install telemetry id (Enhanced) or
   *  none at all (Incognito), both owned by useAnalyticsCollectionGate, and attaching
   *  `me.id` there would join the two identities. The active account is a dependency so
   *  switching back to custodial re-sets it. */
  const isSelfCustodialActive = persistentState
    ? Boolean(resolveActiveSelfCustodialId(persistentState))
    : false

  useEffect(() => {
    if (isSelfCustodialActive) return
    analytics().setUserProperty("hasUsername", data?.me?.username ? "true" : "false")
  }, [data?.me?.username, isSelfCustodialActive])

  useEffect(() => {
    if (isSelfCustodialActive) return
    if (data?.me?.id) {
      analytics().setUserId(data?.me?.id)
    }
  }, [data?.me?.id, isSelfCustodialActive])

  useEffect(() => {
    if (data?.globals?.network) {
      analytics().setUserProperties({ network: data.globals.network })
    }
  }, [data?.globals?.network])

  useEffect(() => {
    if (isSelfCustodialActive) return
    analytics().setUserProperty("accountLevel", level.currentLevel)
  }, [level, isSelfCustodialActive])

  useEffect(() => {
    analytics().setUserProperty("galoyInstance", galoyInstanceName)
  }, [galoyInstanceName])

  return null
}
