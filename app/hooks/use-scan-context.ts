import { useMemo } from "react"

import { createCustodialScanContext } from "@app/custodial/adapters/scan-context-adapter"
import {
  useHomeUnauthedQuery,
  useScanningQrCodeScreenQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { createSelfCustodialScanContext } from "@app/self-custodial/adapters/scan-context-adapter"
import { type ScanContextAdapter } from "@app/types/scan-context"

import { useActiveWallet } from "./use-active-wallet"
import { useAppConfig } from "./use-app-config"

export const useScanContext = (): ScanContextAdapter => {
  const isAuthed = useIsAuthed()
  const { isSelfCustodial, wallets } = useActiveWallet()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()
  const { data } = useScanningQrCodeScreenQuery({ skip: !isAuthed })
  const { data: unauthedData } = useHomeUnauthedQuery({ fetchPolicy: "cache-first" })

  return useMemo((): ScanContextAdapter => {
    if (isSelfCustodial) {
      return createSelfCustodialScanContext(wallets)
    }
    return createCustodialScanContext(
      data,
      unauthedData?.globals?.network ?? null,
      lnAddressHostname,
    )
  }, [isSelfCustodial, wallets, data, unauthedData, lnAddressHostname])
}
