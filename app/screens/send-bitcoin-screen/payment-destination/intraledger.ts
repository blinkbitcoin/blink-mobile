import {
  AccountDefaultWalletLazyQueryHookResult,
  WalletCurrency,
} from "@app/graphql/generated"
import { ZeroBtcMoneyAmount } from "@app/types/amounts"
import { IntraledgerPaymentDestination } from "@blinkbitcoin/blink-client"

import { createIntraledgerPaymentDetails } from "../payment-details"
import {
  CreatePaymentDetailParams,
  DestinationDirection,
  InvalidDestinationReason,
  ParseDestinationResult,
  PaymentDestination,
} from "./index.types"

export type ResolveIntraledgerDestinationParams = {
  parsedIntraledgerDestination: IntraledgerPaymentDestination
  accountDefaultWalletQuery: AccountDefaultWalletLazyQueryHookResult[0]
  myWalletIds: string[]
  flag?: string
}

export const resolveIntraledgerDestination = async ({
  parsedIntraledgerDestination,
  accountDefaultWalletQuery,
  myWalletIds,
  flag,
}: ResolveIntraledgerDestinationParams): Promise<ParseDestinationResult> => {
  const { valid, handle } = parsedIntraledgerDestination

  if (!valid) {
    return {
      valid: false,
      invalidReason: InvalidDestinationReason.WrongDomain,
      invalidPaymentDestination: parsedIntraledgerDestination,
    }
  }

  const lookup = await getUserWalletId({
    username: handle,
    accountDefaultWalletQuery,
    flag,
  })

  if (lookup.status === UserWalletLookup.Unverifiable) {
    return {
      valid: false,
      invalidReason: InvalidDestinationReason.DestinationUnverifiable,
      invalidPaymentDestination: parsedIntraledgerDestination,
    } as const
  }

  if (lookup.status === UserWalletLookup.NotFound) {
    return {
      valid: false,
      invalidReason: InvalidDestinationReason.UsernameDoesNotExist,
      invalidPaymentDestination: parsedIntraledgerDestination,
    } as const
  }

  const handleWalletId = lookup.walletId

  if (myWalletIds.includes(handleWalletId)) {
    return {
      valid: false,
      invalidReason: InvalidDestinationReason.SelfPayment,
      invalidPaymentDestination: parsedIntraledgerDestination,
    } as const
  }

  return createIntraLedgerDestination({
    parsedIntraledgerDestination,
    walletId: handleWalletId,
  })
}

export type CreateIntraLedgerDestinationParams = {
  parsedIntraledgerDestination: IntraledgerPaymentDestination
  walletId: string
}

export const createIntraLedgerDestination = (
  params: CreateIntraLedgerDestinationParams,
): PaymentDestination => {
  const {
    parsedIntraledgerDestination: { handle },
    walletId,
  } = params

  const createPaymentDetail = <T extends WalletCurrency>({
    convertMoneyAmount,
    sendingWalletDescriptor,
  }: CreatePaymentDetailParams<T>) => {
    return createIntraledgerPaymentDetails({
      handle,
      recipientWalletId: walletId,
      sendingWalletDescriptor,
      convertMoneyAmount,
      unitOfAccountAmount: ZeroBtcMoneyAmount,
    })
  }

  return {
    valid: true,
    createPaymentDetail,
    destinationDirection: DestinationDirection.Send,
    validDestination: { ...params.parsedIntraledgerDestination, walletId, valid: true },
  }
}

export const UserWalletLookup = {
  Found: "found",
  /** The backend answered, and holds no account under this name. */
  NotFound: "not-found",
  /** The backend did not answer. Says nothing about whether the name exists. */
  Unverifiable: "unverifiable",
} as const

export type UserWalletLookup = (typeof UserWalletLookup)[keyof typeof UserWalletLookup]

type UserWalletLookupResult =
  | { status: typeof UserWalletLookup.Found; walletId: string }
  | { status: typeof UserWalletLookup.NotFound }
  | { status: typeof UserWalletLookup.Unverifiable }

/**
 * A query that failed at the transport resolves with no data and an error, and so does
 * the backend's answer for an unknown name, which is a GraphQL error ("Account does not
 * exist for username") rather than an empty result. The two are told apart by the kind
 * of error: only a network error means the backend did not answer, so only it is
 * reported as unverifiable. Any other error is an answer that the payee does not exist,
 * which is what lets a custodial sender retry the name as a self-custodial recipient's
 * address.
 *
 * A thrown lookup is treated the same way: whatever went wrong, nothing was learned
 * about the name.
 */
const getUserWalletId = async ({
  flag,
  username,
  accountDefaultWalletQuery,
}: {
  flag: string | undefined
  username: string
  accountDefaultWalletQuery: AccountDefaultWalletLazyQueryHookResult[0]
}): Promise<UserWalletLookupResult> => {
  try {
    const { data, error } = await accountDefaultWalletQuery({
      variables:
        flag?.toUpperCase() === "USD"
          ? { username, walletCurrency: WalletCurrency.Usd }
          : { username },
    })

    const walletId = data?.accountDefaultWallet?.id
    if (walletId) return { status: UserWalletLookup.Found, walletId }
    if (error?.networkError) return { status: UserWalletLookup.Unverifiable }
    return { status: UserWalletLookup.NotFound }
  } catch {
    return { status: UserWalletLookup.Unverifiable }
  }
}
