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
  AccountMetadataDocument,
  AccountMetadataQuery,
  // AccountMetadataEntry,
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

  query accountMetadata {
    accountMetadata @client {
      accountId
      sessionCount
      upgradeModalShown
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

export const getAccountMetadata = (client: ApolloClient<unknown>, accountId: string) => {
  try {
    const result = client.readQuery<AccountMetadataQuery>({
      query: AccountMetadataDocument,
    })

    return (
      result?.accountMetadata.find((entry) => entry.accountId === accountId) ?? {
        accountId,
        sessionCount: 0,
        upgradeModalShown: 0,
      }
    )
  } catch {
    return {
      accountId,
      sessionCount: 0,
      upgradeModalShown: 0,
    }
  }
}

export const updateAccountMetadata = (
  client: ApolloClient<unknown>,
  accountId: string,
  updates: { sessionCount?: number; upgradeModalShown?: number },
) => {
  try {
    const result = client.readQuery<AccountMetadataQuery>({
      query: AccountMetadataDocument,
    })

    const current = result?.accountMetadata ?? []
    const existing = current.find((entry) => entry.accountId === accountId)

    const updatedEntry = {
      accountId,
      sessionCount: updates.sessionCount ?? existing?.sessionCount ?? 0,
      upgradeModalShown: updates.upgradeModalShown ?? existing?.upgradeModalShown ?? 0,
      __typename: "AccountMetadataEntry" as const,
    }

    const newList = [
      ...current.filter((entry) => entry.accountId !== accountId),
      updatedEntry,
    ] as const

    client.writeQuery<AccountMetadataQuery>({
      query: AccountMetadataDocument,
      data: {
        __typename: "Query",
        accountMetadata: newList,
      },
    })
  } catch (err) {
    console.warn("Could not update accountMetadata", err)
  }
}
