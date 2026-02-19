import { useCallback, useEffect, useRef, useState } from "react"
import nfcManager from "react-native-nfc-manager"

import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"

import {
  Invoice,
  InvoiceType,
  PaymentRequestState,
  PaymentRequestStateType,
} from "../payment/index.types"

type NfcReceiveParams = {
  requestType: InvoiceType
  requestState: PaymentRequestStateType | undefined
  hasSettlementAmount: boolean
  handleSetAmount: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  isOnChainPage: boolean
}

type NfcReceiveReturn = {
  displayReceiveNfc: boolean
  setDisplayReceiveNfc: React.Dispatch<React.SetStateAction<boolean>>
  isNfcAmountModalOpen: boolean
  closeNfcAmountModal: () => void
  handleNfcAmountSet: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
  showNfcButton: boolean
  onNfcPress: () => void
}

export const useNfcReceive = ({
  requestType,
  requestState,
  hasSettlementAmount,
  handleSetAmount,
  isOnChainPage,
}: NfcReceiveParams): NfcReceiveReturn => {
  const pendingNfc = useRef(false)
  const [displayReceiveNfc, setDisplayReceiveNfc] = useState(false)
  const [isNfcAmountModalOpen, setIsNfcAmountModalOpen] = useState(false)
  const [nfcSupported, setNfcSupported] = useState(false)

  const closeNfcAmountModal = useCallback(() => setIsNfcAmountModalOpen(false), [])

  const handleNfcAmountSet = useCallback(
    (amount: MoneyAmount<WalletOrDisplayCurrency>) => {
      handleSetAmount(amount)
      pendingNfc.current = true
      setIsNfcAmountModalOpen(false)
    },
    [handleSetAmount],
  )

  const isNfcType =
    !isOnChainPage &&
    (requestType === Invoice.Lightning || requestType === Invoice.PayCode)

  const showNfcButton =
    isNfcType && requestState === PaymentRequestState.Created && nfcSupported

  const onNfcPress = useCallback(() => {
    if (!hasSettlementAmount) {
      setIsNfcAmountModalOpen(true)
      return
    }
    setDisplayReceiveNfc(true)
  }, [hasSettlementAmount])

  useEffect(() => {
    nfcManager
      .isSupported()
      .then(setNfcSupported)
      .catch(() => setNfcSupported(false))
  }, [])

  useEffect(() => {
    if (!pendingNfc.current) return
    if (requestType !== Invoice.Lightning) return
    if (requestState !== PaymentRequestState.Created) return
    pendingNfc.current = false
    setDisplayReceiveNfc(true)
  }, [requestType, requestState])

  return {
    displayReceiveNfc,
    setDisplayReceiveNfc,
    isNfcAmountModalOpen,
    closeNfcAmountModal,
    handleNfcAmountSet,
    showNfcButton,
    onNfcPress,
  }
}
