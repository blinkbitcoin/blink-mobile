import { useEffect } from "react"

import { gql } from "@apollo/client"
import { useAnalyticsQuery } from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import {
  setCustodialIdentity,
  setSharedUserProperties,
} from "@app/self-custodial/analytics-identity"

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
  const {
    appConfig: {
      galoyInstance: { name: galoyInstanceName },
    },
  } = useAppConfig()

  const { data } = useAnalyticsQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
  })

  /** Identity is handed to its single owner, which attaches it only while the custodial
   *  account is active: a self-custodial session reports under the per-install telemetry
   *  id (Enhanced) or none at all (Incognito), on a separate GA4 app instance, and
   *  attaching `me.id` there would join the two identities. */
  useEffect(() => {
    setCustodialIdentity({
      userId: data?.me?.id,
      hasUsername: Boolean(data?.me?.username),
      accountLevel: level.currentLevel,
    })
  }, [data?.me?.id, data?.me?.username, level.currentLevel])

  useEffect(() => {
    if (data?.globals?.network) {
      setSharedUserProperties({ network: data.globals.network })
    }
  }, [data?.globals?.network])

  useEffect(() => {
    setSharedUserProperties({ galoyInstance: galoyInstanceName })
  }, [galoyInstanceName])

  return null
}
