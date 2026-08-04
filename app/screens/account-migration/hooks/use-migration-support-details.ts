import { useEffect, useState } from "react"

import { gql } from "@apollo/client"

import { useMigrationSupportDetailsQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLoadWalletMnemonic } from "@app/screens/self-custodial/onboarding/hooks/use-wallet-mnemonic"
import { deriveWalletIdentityPubkey } from "@app/self-custodial/bridge"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"

gql`
  query migrationSupportDetails {
    me {
      id
      phone
      username
      email {
        address
      }
      defaultAccount {
        id
      }
    }
  }
`

type MigrationSupportDetails = {
  accountId: string
  pubKey: string
  username: string
  email: string
  phone: string
}

/**
 * Gathers the diagnostics the support team needs to resolve a failed migration: the
 * custodial account identity from the backend plus the provisioned self-custodial
 * wallet's identity pubkey derived on device.
 */
export const useMigrationSupportDetails = (): MigrationSupportDetails => {
  const isAuthed = useIsAuthed()
  /** no-cache: a cached me could serve the previous account's identity after a switch. */
  const { data } = useMigrationSupportDetailsQuery({
    skip: !isAuthed,
    fetchPolicy: "no-cache",
  })
  const loadMnemonic = useLoadWalletMnemonic()
  const network = useSparkNetwork()
  const [pubKey, setPubKey] = useState("")

  /** Derive the pubkey from a transiently-loaded phrase instead of holding the full phrase
   *  resident: this screen shows only the pubkey, never the words. */
  useEffect(() => {
    let mounted = true
    loadMnemonic().then((mnemonic) => {
      if (!mounted) return
      setPubKey(mnemonic ? deriveWalletIdentityPubkey(mnemonic, network) : "")
    })
    return () => {
      mounted = false
    }
  }, [loadMnemonic, network])

  return {
    accountId: data?.me?.defaultAccount?.id ?? "",
    pubKey,
    username: data?.me?.username ?? "",
    email: data?.me?.email?.address ?? "",
    phone: data?.me?.phone ?? "",
  }
}
