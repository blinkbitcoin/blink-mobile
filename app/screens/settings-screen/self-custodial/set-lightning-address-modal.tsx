import React from "react"

import { SetLightningAddressModalUI } from "@app/components/set-lightning-address-modal"
import { useAppConfig } from "@app/hooks"
import { lnurlDomainFor } from "@app/self-custodial/config"
import { useRegisterLightningAddress } from "@app/self-custodial/hooks/use-register-lightning-address"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"

type SetSelfCustodialLightningAddressModalProps = {
  isVisible: boolean
  toggleModal: () => void
}

export const SetSelfCustodialLightningAddressModal = ({
  isVisible,
  toggleModal,
}: SetSelfCustodialLightningAddressModalProps) => {
  const network = useSparkNetwork()
  const {
    appConfig: {
      galoyInstance: { name: bankName },
    },
  } = useAppConfig()
  const { lnAddress, error, loading, setLnAddress, register } =
    useRegisterLightningAddress(toggleModal)

  return (
    <SetLightningAddressModalUI
      isVisible={isVisible}
      toggleModal={toggleModal}
      onSetLightningAddress={register}
      loading={loading}
      error={error}
      lnAddress={lnAddress}
      setLnAddress={setLnAddress}
      hostname={lnurlDomainFor(network)}
      bankName={bankName}
    />
  )
}
