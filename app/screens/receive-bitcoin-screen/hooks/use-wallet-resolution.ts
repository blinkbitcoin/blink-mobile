import { gql } from "@apollo/client"
import {
  Network,
  PaymentRequestQuery,
  WalletCurrency,
  usePaymentRequestQuery,
  useRealtimePriceQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getDefaultWallet, getUsdWallet } from "@app/graphql/wallets-utils"
import { useAppConfig, usePriceConversion } from "@app/hooks"
import { ConvertMoneyAmount } from "@app/screens/send-bitcoin-screen/payment-details"

gql`
  query paymentRequest {
    globals {
      network
      feesInformation {
        deposit {
          minBankFee
          minBankFeeThreshold
          ratio
        }
      }
    }
    me {
      id
      username
      defaultAccount {
        id
        wallets {
          id
          balance
          walletCurrency
        }
        defaultWalletId
      }
    }
  }

  mutation lnNoAmountInvoiceCreate($input: LnNoAmountInvoiceCreateInput!) {
    lnNoAmountInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        createdAt
        paymentHash
        paymentRequest
        paymentStatus
        externalId
      }
    }
  }

  mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {
    lnInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        createdAt
        paymentHash
        paymentRequest
        paymentStatus
        externalId
        satoshis
      }
    }
  }

  mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {
    onChainAddressCurrent(input: $input) {
      errors {
        message
      }
      address
    }
  }

  mutation lnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {
    lnUsdInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        createdAt
        paymentHash
        paymentRequest
        paymentStatus
        externalId
        satoshis
      }
    }
  }
`

type Wallet = {
  id: string
  balance: number
  walletCurrency: WalletCurrency
}

export type WalletResolution = {
  defaultWallet: Wallet | undefined
  bitcoinWallet: Wallet | undefined
  usdWallet: Wallet | undefined
  username: string | null | undefined
  posUrl: string
  lnAddressHostname: string
  convertMoneyAmount: ConvertMoneyAmount | undefined
  network: Network
  feesInformation: NonNullable<PaymentRequestQuery["globals"]>["feesInformation"]
}

export const useWalletResolution = (): WalletResolution | null => {
  const isAuthed = useIsAuthed()

  const { data } = usePaymentRequestQuery({
    fetchPolicy: "cache-and-network",
    skip: !isAuthed,
  })

  useRealtimePriceQuery({
    fetchPolicy: "network-only",
    skip: !isAuthed,
  })

  const defaultWallet = getDefaultWallet(
    data?.me?.defaultAccount?.wallets,
    data?.me?.defaultAccount?.defaultWalletId,
  )

  const bitcoinWallet = getBtcWallet(data?.me?.defaultAccount?.wallets)
  const usdWallet = getUsdWallet(data?.me?.defaultAccount?.wallets)

  const username = data?.me?.username

  const appConfig = useAppConfig().appConfig
  const posUrl = appConfig.galoyInstance.posUrl
  const lnAddressHostname = appConfig.galoyInstance.lnAddressHostname

  const { convertMoneyAmount } = usePriceConversion()

  if (!defaultWallet || !bitcoinWallet || !posUrl || !data?.globals?.network) {
    return null
  }

  return {
    defaultWallet,
    bitcoinWallet,
    usdWallet,
    username,
    posUrl,
    lnAddressHostname,
    convertMoneyAmount,
    network: data.globals.network,
    feesInformation: data.globals.feesInformation ?? undefined,
  }
}
