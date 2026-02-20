import { RefObject, useCallback, useRef, useState } from "react"
import { ICarouselInstance } from "react-native-reanimated-carousel"

import { WalletCurrency } from "@app/graphql/generated"
import { AccountLevel, useLevel } from "@app/graphql/level-context"

import { GetFullUriFn } from "../payment/index.types"
import { useOnChainAddress } from "./use-onchain-address"
import { usePaymentRequest } from "./use-payment-request"

type RequestState = NonNullable<ReturnType<typeof usePaymentRequest>>

type OnChainState = {
  address: string | null
  loading: boolean
  error: string | null
  getFullUriFn: GetFullUriFn | undefined
}

enum CarouselPage {
  Lightning = 0,
  OnChain = 1,
}

type CarouselReturn = {
  ref: RefObject<ICarouselInstance>
  isOnChainPage: boolean
  onchainWalletCurrency: WalletCurrency
  syncOnchainWallet: (currency: WalletCurrency) => void
  onchain: OnChainState
  handleSnap: (index: number) => void
}

export const useReceiveCarousel = (
  request: RequestState,
  onLevelZeroBlock: () => void,
): CarouselReturn => {
  const { currentLevel } = useLevel()
  const isLevelZero = currentLevel === AccountLevel.Zero

  const carouselRef = useRef<ICarouselInstance>(null)
  const [activePage, setActivePage] = useState(CarouselPage.Lightning)
  const isOnChainPage = activePage === CarouselPage.OnChain

  const [onchainWalletCurrency, setOnchainWalletCurrency] = useState<WalletCurrency>(
    WalletCurrency.Btc,
  )

  const onchainWalletId =
    onchainWalletCurrency === WalletCurrency.Btc
      ? request.btcWalletId
      : request.usdWalletId

  const onchain = useOnChainAddress(onchainWalletId, {
    amount: request.settlementAmount?.amount,
    memo: request.memo || undefined,
  })

  const handleSnap = useCallback(
    (index: number) => {
      if (index === CarouselPage.OnChain && isLevelZero) {
        onLevelZeroBlock()
        carouselRef.current?.scrollTo({ index: CarouselPage.Lightning, animated: true })
        return
      }
      setActivePage(index === 0 ? CarouselPage.Lightning : CarouselPage.OnChain)
      if (index === CarouselPage.OnChain) {
        setOnchainWalletCurrency(request.receivingWalletDescriptor.currency)
      }
    },
    [isLevelZero, onLevelZeroBlock, request.receivingWalletDescriptor.currency],
  )

  return {
    ref: carouselRef,
    isOnChainPage,
    onchainWalletCurrency,
    syncOnchainWallet: setOnchainWalletCurrency,
    onchain,
    handleSnap,
  }
}
