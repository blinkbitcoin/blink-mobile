import { useCallback, useEffect, useRef, useState } from "react"

import { gql, useApolloClient } from "@apollo/client"

import {
  TransactionByIdForWalletQuery,
  TransactionOwnershipProbeQuery,
  useTransactionByIdForWalletLazyQuery,
  useTransactionOwnershipProbeLazyQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { DefaultAccountId } from "@app/types/wallet"
import { recordAppError } from "@app/utils/error-reporting"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"
import { toastShow } from "@app/utils/toast"
import { withTimeout } from "@app/utils/with-timeout"

import { useAccountRegistry } from "./use-account-registry"
import { useAppConfig } from "./use-app-config"

gql`
  query transactionOwnershipProbe($first: Int) {
    me {
      id
      defaultAccount {
        id
        wallets {
          id
        }
        pendingIncomingTransactions {
          id
        }
        transactions(first: $first) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  }

  query transactionByIdForWallet($walletId: WalletId!, $txId: ID!) {
    me {
      id
      defaultAccount {
        id
        walletById(walletId: $walletId) {
          id
          transactionById(transactionId: $txId) {
            ...Transaction
          }
        }
      }
    }
  }
`

export const OWNERSHIP_PROBE_TX_COUNT = 30
const PROBE_TIMEOUT_MS = 6000

/** Transport-level probe failure: "couldn't check", as opposed to "definitively absent". */
export class ProbeNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProbeNetworkError"
  }
}

const bearerContext = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
})

type ProbeQueryResult<TData> = {
  data?: TData
  error?: { message: string; networkError?: unknown }
}

type ProbeExecutors = {
  probeOwnership: (options: {
    variables: { first: number }
    fetchPolicy: "no-cache"
    errorPolicy: "all"
    context?: ReturnType<typeof bearerContext>
  }) => Promise<ProbeQueryResult<TransactionOwnershipProbeQuery>>
  probeWallet: (options: {
    variables: { walletId: string; txId: string }
    fetchPolicy: "no-cache" | "network-only"
    errorPolicy: "all"
    context?: ReturnType<typeof bearerContext>
  }) => Promise<ProbeQueryResult<TransactionByIdForWalletQuery>>
}

/**
 * Checks whether `txid` belongs to the account behind `token` (or the active
 * account when `token` is undefined). Active-account wallet probes are
 * cache-writing so a hit also materializes the transaction for `useFragment`;
 * foreign probes never touch the active cache. Throws ProbeNetworkError when
 * ownership could not be determined.
 */
export const probeAccountForTransaction = async ({
  txid,
  token,
  probeOwnership,
  probeWallet,
  timeoutMs = PROBE_TIMEOUT_MS,
}: {
  txid: string
  token?: string
  timeoutMs?: number
} & ProbeExecutors): Promise<{ found: boolean }> => {
  const context = token ? bearerContext(token) : undefined

  const ownership = await withTimeout(
    probeOwnership({
      variables: { first: OWNERSHIP_PROBE_TX_COUNT },
      fetchPolicy: "no-cache",
      errorPolicy: "all",
      ...(context ? { context } : {}),
    }),
    timeoutMs,
    "transaction ownership probe",
  )

  const account = ownership.data?.me?.defaultAccount
  if (!account) {
    throw new ProbeNetworkError(
      ownership.error?.message ?? "ownership probe returned no account",
    )
  }

  const recentIds = [
    ...account.pendingIncomingTransactions.map((tx) => tx.id),
    ...(account.transactions?.edges?.map((edge) => edge.node.id) ?? []),
  ]
  const foundInList = recentIds.includes(txid)

  // Foreign account: the id-only list scan is enough — no cache to fill.
  if (foundInList && token) return { found: true }

  // Active account (materialize into cache), or older than the list window:
  // ask each wallet directly. A GraphQL error without a transport error means
  // "not in this wallet".
  for (const wallet of account.wallets) {
    const result = await withTimeout(
      probeWallet({
        variables: { walletId: wallet.id, txId: txid },
        fetchPolicy: token ? "no-cache" : "network-only",
        errorPolicy: "all",
        ...(context ? { context } : {}),
      }),
      timeoutMs,
      "transaction wallet probe",
    )
    if (result.data?.me?.defaultAccount?.walletById?.transactionById?.id === txid) {
      return { found: true }
    }
    if (result.error?.networkError) {
      throw new ProbeNetworkError(result.error.message)
    }
  }

  // The list said the tx is there but no wallet returned it — report found so
  // the caller doesn't switch away; the screen's retry path covers the gap.
  return { found: foundInList }
}

const displayIdentifier = (profile: ProfileProps): string =>
  profile.hasUsername && profile.lnAddressHostname
    ? `${profile.identifier}@${profile.lnAddressHostname}`
    : profile.identifier

export type ResolveTransactionAccountStatus =
  | "idle"
  | "resolving"
  | "switching"
  | "resolved"
  | "notFound"
  | "probeFailed"

/**
 * Resolves which account on this device owns `txid` when the transaction is
 * missing from the active account's cache (typically after tapping a payment
 * push notification on a multi-account device — the payload does not identify
 * the receiving account, see #3826).
 *
 * Probes the active account first, then the other saved session profiles via
 * per-request Bearer overrides; on a unique foreign hit it switches to that
 * profile and lets the rebuilt Apollo client re-run the resolution, which
 * materializes the transaction into the now-active cache. Never switches when
 * ownership is ambiguous (probe failures).
 */
export const useResolveTransactionAccount = ({
  txid,
  hasTx,
  recipientUserId,
}: {
  txid: string
  hasTx: boolean
  recipientUserId?: string
}): { status: ResolveTransactionAccountStatus; retry: () => void } => {
  const client = useApolloClient()
  const isAuthed = useIsAuthed()
  const { LL } = useI18nContext()
  const {
    saveToken,
    appConfig: { token: activeToken },
  } = useAppConfig()
  const { setActiveAccountId } = useAccountRegistry()
  const [probeOwnership] = useTransactionOwnershipProbeLazyQuery()
  const [probeWallet] = useTransactionByIdForWalletLazyQuery()

  const [status, setStatus] = useState<ResolveTransactionAccountStatus>("idle")
  const [attempt, setAttempt] = useState(0)
  // Only read at toast time — kept out of the effect deps so a re-render (or
  // locale change) can't cancel an in-flight resolution.
  const llRef = useRef(LL)
  llRef.current = LL
  const processedRef = useRef<{ txid: string; client: unknown; attempt: number } | null>(
    null,
  )
  // Survives the post-switch Apollo client rebuild so the second pass knows a
  // switch already happened and must not trigger another one.
  const switchedRef = useRef(false)

  const retry = useCallback(() => {
    processedRef.current = null
    switchedRef.current = false
    setAttempt((current) => current + 1)
  }, [])

  useEffect(() => {
    if (hasTx) {
      // Settle on "resolved" even from "idle": callers treat a lingering
      // "idle" as still-resolving, which would spin forever when the tx is
      // only available outside the fragment cache (self-custodial memory).
      setStatus("resolved")
      return
    }

    const alreadyProcessed =
      processedRef.current &&
      processedRef.current.txid === txid &&
      processedRef.current.client === client &&
      processedRef.current.attempt === attempt
    if (alreadyProcessed) return
    processedRef.current = { txid, client, attempt }

    let cancelled = false

    /**
     * `alwaysRecord` because a ProbeNetworkError's class name matches the connectivity
     * heuristic, which would otherwise downgrade a genuine probe defect (e.g. "ownership
     * probe returned no account") to a breadcrumb. Recording every probe failure keeps the
     * long-standing behaviour; only the reporting boundary changed.
     */
    const recordProbeError = (err: unknown) => {
      if (err instanceof Error) recordAppError(err, { alwaysRecord: true })
    }

    const run = async () => {
      // Consume the switch marker up front: this pass either resolves the tx
      // under the newly-active account or fails — it never switches again.
      const continuingAfterSwitch = switchedRef.current
      switchedRef.current = false
      setStatus(continuingAfterSwitch ? "switching" : "resolving")

      if (isAuthed) {
        try {
          const active = await probeAccountForTransaction({
            txid,
            probeOwnership,
            probeWallet,
          })
          if (cancelled) return
          if (active.found) {
            setStatus("resolved")
            return
          }
        } catch (err) {
          if (cancelled) return
          recordProbeError(err)
          setStatus("probeFailed")
          return
        }
      }

      if (continuingAfterSwitch) {
        // We already switched to the profile that reported this tx and it is
        // gone on the second look — stop rather than probing/switching again.
        setStatus("probeFailed")
        return
      }

      let profiles: ProfileProps[] = []
      try {
        profiles = await KeyStoreWrapper.getSessionProfiles()
      } catch (err) {
        recordProbeError(err)
      }
      if (cancelled) return

      const foreign = profiles.filter(
        (profile) => Boolean(profile.token) && profile.token !== activeToken,
      )
      if (foreign.length === 0) {
        setStatus("notFound")
        return
      }

      // With a payload hint we can resolve with a single probe; fall back to
      // scanning the remaining profiles only if the hint misses.
      const hinted = recipientUserId
        ? foreign.filter((profile) => profile.userId === recipientUserId)
        : []
      const batches = hinted.length
        ? [hinted, foreign.filter((profile) => !hinted.includes(profile))]
        : [foreign]

      let sawProbeFailure = false
      for (const batch of batches) {
        const results = await Promise.allSettled(
          batch.map(async (profile) => ({
            profile,
            found: (
              await probeAccountForTransaction({
                txid,
                token: profile.token,
                probeOwnership,
                probeWallet,
              })
            ).found,
          })),
        )
        if (cancelled) return

        const failures = results.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        )
        failures.forEach((failure) => recordProbeError(failure.reason))
        sawProbeFailure = sawProbeFailure || failures.length > 0

        const hits = results.filter(
          (
            result,
          ): result is PromiseFulfilledResult<{
            profile: ProfileProps
            found: boolean
          }> => result.status === "fulfilled" && result.value.found,
        )

        if (hits.length === 1) {
          const { profile } = hits[0].value
          switchedRef.current = true
          setStatus("switching")
          try {
            await saveToken(profile.token)
          } catch (err) {
            switchedRef.current = false
            if (cancelled) return
            recordProbeError(err)
            setStatus("probeFailed")
            return
          }
          setActiveAccountId(DefaultAccountId.Custodial)
          // Toast only once the switch has actually persisted.
          toastShow({
            type: "success",
            message: (translations) =>
              translations.TransactionDetailScreen.switchedForPayment({
                identifier: displayIdentifier(profile),
              }),
            LL: llRef.current,
          })
          // The token change rebuilds the Apollo client; the effect re-runs
          // under the new client and materializes the tx via the active path.
          return
        }
        if (hits.length > 1) {
          // A tx lives in exactly one account — duplicate hits mean the data
          // cannot be trusted, so never switch on it.
          setStatus("probeFailed")
          return
        }
      }

      setStatus(sawProbeFailure ? "probeFailed" : "notFound")
    }

    run()
    return () => {
      cancelled = true
    }
  }, [
    txid,
    hasTx,
    client,
    attempt,
    isAuthed,
    activeToken,
    recipientUserId,
    probeOwnership,
    probeWallet,
    saveToken,
    setActiveAccountId,
  ])

  return { status, retry }
}
