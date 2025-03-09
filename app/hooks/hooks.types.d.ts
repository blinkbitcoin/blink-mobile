type SetConvertedAmountsInput = {
  moneyAmount: MoneyAmount
}

type mobileVersions = {
  currentSupported: string
  minSupported: string
  platform: string
}

type useMainQueryOutput = {
  userPreferredLanguage: string
  btcWalletBalance: number
  btcWalletId: string
  transactionsEdges: object[]
  me: any
  myPubKey: string
  username?: string
  phoneNumber: string
  email?: string
  mobileVersions: mobileVersions
  loading: boolean
  refetch: () => void
  errors: object[]
}
