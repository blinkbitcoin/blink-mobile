import { useEffect } from "react"

import { gql } from "@apollo/client"
import { useAnalyticsQuery } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { setCustodialAnalyticsIdentity } from "@app/telemetry"

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

/**
 * Custodial analytics identity, and the one place it is set.
 *
 * These used to be direct `setUserId` / `setUserProperty` calls. Firebase merges
 * user-scoped identity into every subsequent event, and the `setUserId` here — the Blink
 * ledger account ID — was never cleared, so a self-custodial event would have inherited a
 * §5.3-prohibited identifier without any call site doing anything wrong. An import-path ban
 * cannot see that, because the call sat inside a file already allowed to import analytics.
 *
 * Routing through the boundary is what makes the identity clearable: the mode gate drops it
 * the moment the resolved mode stops being Custodial (AD-16).
 */
export const AnalyticsContainer = () => {
  const isAuthed = useIsAuthed()
  const level = useLevel()
  const {
    appConfig: {
      galoyInstance: { name: galoyInstanceName },
    },
  } = useAppConfig()

  const { data } = useAnalyticsQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
  })

  const userId = data?.me?.id
  const network = data?.globals?.network

  useEffect(() => {
    setCustodialAnalyticsIdentity({
      properties: { hasUsername: data?.me?.username ? "true" : "false" },
    })
  }, [data?.me?.username])

  useEffect(() => {
    if (userId) setCustodialAnalyticsIdentity({ userId })
  }, [userId])

  useEffect(() => {
    if (network) setCustodialAnalyticsIdentity({ properties: { network } })
  }, [network])

  useEffect(() => {
    setCustodialAnalyticsIdentity({
      properties: { accountLevel: level.currentLevel },
    })
  }, [level])

  useEffect(() => {
    setCustodialAnalyticsIdentity({
      properties: { galoyInstance: galoyInstanceName },
    })
  }, [galoyInstanceName])

  return null
}
