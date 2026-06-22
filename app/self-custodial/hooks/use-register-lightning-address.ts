import { useState } from "react"

import {
  SetUsernameError,
  validateUsername,
} from "@app/components/set-lightning-address-modal/username-validation"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import {
  checkLightningAddressAvailable,
  registerLightningAddress,
} from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"

type UseRegisterLightningAddress = {
  lnAddress: string
  error?: SetUsernameError
  loading: boolean
  setLnAddress: (value: string) => void
  register: () => Promise<void>
}

export const useRegisterLightningAddress = (
  onRegistered: () => void,
): UseRegisterLightningAddress => {
  const { sdk, updateCurrentSelfCustodialAccount } = useSelfCustodialWallet()
  const guard = useInFlightGuard()
  const [lnAddress, setLnAddressValue] = useState("")
  const [error, setError] = useState<SetUsernameError | undefined>()
  const [loading, setLoading] = useState(false)

  const setLnAddress = (value: string) => {
    setLnAddressValue(value)
    setError(undefined)
  }

  const register = async () => {
    await guard.run(async () => {
      const validation = validateUsername(lnAddress)
      if (!validation.valid) {
        setError(validation.error)
        return
      }
      if (!sdk) {
        setError(SetUsernameError.UNKNOWN_ERROR)
        return
      }

      setLoading(true)
      try {
        const available = await checkLightningAddressAvailable(sdk, lnAddress)
        if (!available) {
          setError(SetUsernameError.ADDRESS_UNAVAILABLE)
          return
        }
        await registerLightningAddress(sdk, lnAddress)
        await updateCurrentSelfCustodialAccount()
        onRegistered()
      } catch {
        setError(SetUsernameError.UNKNOWN_ERROR)
      } finally {
        setLoading(false)
      }
    })
  }

  return { lnAddress, error, loading, setLnAddress, register }
}
