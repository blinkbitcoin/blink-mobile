import { CountryCode } from "libphonenumber-js/mobile"
import { Region } from "react-native-maps"

import { ApolloClient, gql } from "@apollo/client"

import {
  BetaDocument,
  BetaQuery,
  ColorSchemeDocument,
  ColorSchemeQuery,
  CountryCodeDocument,
  CountryCodeQuery,
  FeedbackModalShownDocument,
  FeedbackModalShownQuery,
  HasPromptedSetDefaultAccountDocument,
  HiddenBalanceToolTipDocument,
  HiddenBalanceToolTipQuery,
  HideBalanceDocument,
  HideBalanceQuery,
  InnerCircleValueDocument,
  InnerCircleValueQuery,
  IntroducingCirclesModalShownDocument,
  IntroducingCirclesModalShownQuery,
  RegionDocument,
  RegionQuery,
  UpgradeModalLastShownAtDocument,
  UpgradeModalLastShownAtQuery,
  DeviceSessionCountDocument,
  DeviceSessionCountQuery,
  TxLastSeenDocument,
  TxLastSeenQuery,
  WalletCurrency,
} from "./generated"

export default gql`
  query hideBalance {
    hideBalance @client
  }

  query hiddenBalanceToolTip {
    hiddenBalanceToolTip @client
  }

  query beta {
    beta @client
  }

  query colorScheme {
    colorScheme @client # "system" | "light" | "dark"
  }

  query countryCode {
    countryCode @client
  }

  query region {
    region @client {
      latitude
      longitude
      latitudeDelta
      longitudeDelta
    }
  }

  query feedbackModalShown {
    feedbackModalShown @client
  }

  query hasPromptedSetDefaultAccount {
    hasPromptedSetDefaultAccount @client
  }

  query introducingCirclesModalShown {
    introducingCirclesModalShown @client
  }

  query innerCircleValue {
    innerCircleValue @client
  }

  query upgradeModalLastShownAt {
    upgradeModalLastShownAt @client
  }

  query deviceSessionCount {
    deviceSessionCount @client
  }

  query txLastSeen {
    txLastSeen @client {
      btcId
      usdId
    }
  }
`

export const saveHideBalance = (
  client: ApolloClient<unknown>,
  status: boolean,
): boolean => {
  try {
    client.writeQuery<HideBalanceQuery>({
      query: HideBalanceDocument,
      data: {
        __typename: "Query",
        hideBalance: status,
      },
    })
    return status
  } catch {
    return false
  }
}

export const saveHiddenBalanceToolTip = (
  client: ApolloClient<unknown>,
  status: boolean,
): boolean => {
  try {
    client.writeQuery<HiddenBalanceToolTipQuery>({
      query: HiddenBalanceToolTipDocument,
      data: {
        __typename: "Query",
        hiddenBalanceToolTip: status,
      },
    })
    return status
  } catch {
    return false
  }
}

export const activateBeta = (client: ApolloClient<unknown>, status: boolean) => {
  try {
    client.writeQuery<BetaQuery>({
      query: BetaDocument,
      data: {
        __typename: "Query",
        beta: status,
      },
    })
  } catch {
    console.warn("impossible to update beta")
  }
}

export const updateColorScheme = (client: ApolloClient<unknown>, colorScheme: string) => {
  try {
    client.writeQuery<ColorSchemeQuery>({
      query: ColorSchemeDocument,
      data: {
        __typename: "Query",
        colorScheme,
      },
    })
  } catch {
    console.warn("impossible to update color scheme")
  }
}

export const updateCountryCode = (
  client: ApolloClient<unknown>,
  countryCode: CountryCode,
) => {
  try {
    client.writeQuery<CountryCodeQuery>({
      query: CountryCodeDocument,
      data: {
        __typename: "Query",
        countryCode,
      },
    })
  } catch {
    console.warn("impossible to update country code")
  }
}

export const updateMapLastCoords = (client: ApolloClient<unknown>, region: Region) => {
  try {
    client.writeQuery<RegionQuery>({
      query: RegionDocument,
      data: {
        __typename: "Query",
        region: {
          __typename: "Region",
          ...region,
        },
      },
    })
  } catch {
    console.warn("impossible to update map last coords")
  }
}

export const setFeedbackModalShown = (client: ApolloClient<unknown>, shown: boolean) => {
  try {
    client.writeQuery<FeedbackModalShownQuery>({
      query: FeedbackModalShownDocument,
      data: {
        __typename: "Query",
        feedbackModalShown: shown,
      },
    })
  } catch {
    console.warn("unable to update feedbackModalShown")
  }
}

export const setHasPromptedSetDefaultAccount = (client: ApolloClient<unknown>) => {
  try {
    client.writeQuery({
      query: HasPromptedSetDefaultAccountDocument,
      data: {
        __typename: "Query",
        hasPromptedSetDefaultAccount: true,
      },
    })
  } catch {
    console.warn("impossible to update hasPromptedSetDefaultAccount")
  }
}

export const setIntroducingCirclesModalShown = (client: ApolloClient<unknown>) => {
  try {
    client.writeQuery<IntroducingCirclesModalShownQuery>({
      query: IntroducingCirclesModalShownDocument,
      data: {
        __typename: "Query",
        introducingCirclesModalShown: true,
      },
    })
  } catch {
    console.warn("unable to update introducingCirclesModalShown")
  }
}

export const setInnerCircleCachedValue = (
  client: ApolloClient<unknown>,
  innerCircleValue: number,
) => {
  try {
    client.writeQuery<InnerCircleValueQuery>({
      query: InnerCircleValueDocument,
      data: {
        __typename: "Query",
        innerCircleValue,
      },
    })
  } catch {
    console.warn("unable to update InnerCircleValueDocument")
  }
}

export const setUpgradeModalLastShownAt = (
  client: ApolloClient<unknown>,
  isoDatetime: string | null,
): string | null => {
  try {
    client.writeQuery<UpgradeModalLastShownAtQuery>({
      query: UpgradeModalLastShownAtDocument,
      data: {
        __typename: "Query",
        upgradeModalLastShownAt: isoDatetime,
      },
    })
    return isoDatetime
  } catch {
    return null
  }
}

export const setDeviceSessionCount = (
  client: ApolloClient<unknown>,
  count: number,
): number | null => {
  try {
    client.writeQuery<DeviceSessionCountQuery>({
      query: DeviceSessionCountDocument,
      data: { __typename: "Query", deviceSessionCount: count },
    })
    return count
  } catch {
    return null
  }
}

export const updateDeviceSessionCount = (
  client: ApolloClient<unknown>,
  { reset = false }: { reset?: boolean } = {},
): number | null => {
  if (reset) return setDeviceSessionCount(client, 0)

  const prev =
    client.readQuery<DeviceSessionCountQuery>({
      query: DeviceSessionCountDocument,
    })?.deviceSessionCount ?? 0

  return setDeviceSessionCount(client, prev + 1)
}

export const markTxLastSeenId = (
  client: ApolloClient<unknown>,
  currency: WalletCurrency,
  id: string,
): string | null => {
  try {
    if (!id) return null

    const prev = client.readQuery<TxLastSeenQuery>({ query: TxLastSeenDocument })

    client.writeQuery<TxLastSeenQuery>({
      query: TxLastSeenDocument,
      data: {
        __typename: "Query",
        txLastSeen: {
          __typename: "TxLastSeen",
          btcId: currency === WalletCurrency.Btc ? id : prev?.txLastSeen?.btcId ?? "",
          usdId: currency === WalletCurrency.Usd ? id : prev?.txLastSeen?.usdId ?? "",
        },
      },
    })

    return id
  } catch {
    return null
  }
}
