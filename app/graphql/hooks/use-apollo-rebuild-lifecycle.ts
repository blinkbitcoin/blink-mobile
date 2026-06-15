import { useEffect, useRef } from "react"

import { ApolloClient, NormalizedCacheObject } from "@apollo/client"
import crashlytics from "@react-native-firebase/crashlytics"

import { reportError } from "@app/utils/error-logging"

type RegisterActiveClient = (client: ApolloClient<NormalizedCacheObject>) => void

/** Logs the token-swap as a breadcrumb and aborts the outgoing client; `stop()` failures are reported but never block the new client's build. */
const handleRebuild = (
  previousClient: ApolloClient<NormalizedCacheObject> | null,
  nextTokenPresent: boolean,
): void => {
  if (!previousClient) return
  crashlytics().log(`Apollo client rebuild: token present=${nextTokenPresent}`)
  try {
    previousClient.stop()
  } catch (err) {
    reportError("Apollo client stop", err)
  }
}

export const useApolloRebuildLifecycle = (
  effectiveToken: string,
): { registerActiveClient: RegisterActiveClient } => {
  const previousClientRef = useRef<ApolloClient<NormalizedCacheObject> | null>(null)

  useEffect(() => {
    handleRebuild(previousClientRef.current, Boolean(effectiveToken))
  }, [effectiveToken])

  const registerActiveClient = useRef<RegisterActiveClient>((client) => {
    previousClientRef.current = client
  }).current

  return { registerActiveClient }
}
