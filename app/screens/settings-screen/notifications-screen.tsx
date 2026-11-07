import * as React from "react"
import { TextInput } from "react-native"

import { gql } from "@apollo/client"
import {
  AccountDisableNotificationCategoryMutation,
  AccountEnableNotificationCategoryMutation,
  NotificationChannel,
  NotificationSettings,
  useAccountDisableNotificationCategoryMutation,
  useAccountEnableNotificationCategoryMutation,
  useNotificationSettingsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ListItem, makeStyles, Text } from "@rn-vui/themed"

import { Screen } from "@app/components/screen"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { Switch } from "@app/components/atomic/switch"
import {
  toastSplashSetting,
  useSplashSettings,
} from "@app/screens/receive-bitcoin-screen/incoming-transaction-splash"
import { logIncomingTransactionSplashSettingChanged } from "@app/utils/analytics"
import { SettingsGroup } from "./group"

gql`
  query notificationSettings {
    me {
      id
      defaultAccount {
        id
        notificationSettings {
          push {
            enabled
            disabledCategories
          }
        }
      }
    }
  }

  mutation accountEnableNotificationChannel(
    $input: AccountEnableNotificationChannelInput!
  ) {
    accountEnableNotificationChannel(input: $input) {
      errors {
        message
      }
      account {
        id
        notificationSettings {
          push {
            enabled
            disabledCategories
          }
        }
      }
    }
  }

  mutation accountDisableNotificationChannel(
    $input: AccountDisableNotificationChannelInput!
  ) {
    accountDisableNotificationChannel(input: $input) {
      errors {
        message
      }
      account {
        id
        notificationSettings {
          push {
            enabled
            disabledCategories
          }
        }
      }
    }
  }

  mutation accountEnableNotificationCategory(
    $input: AccountEnableNotificationCategoryInput!
  ) {
    accountEnableNotificationCategory(input: $input) {
      errors {
        message
      }
      account {
        id
        notificationSettings {
          push {
            enabled
            disabledCategories
          }
        }
      }
    }
  }

  mutation accountDisableNotificationCategory(
    $input: AccountDisableNotificationCategoryInput!
  ) {
    accountDisableNotificationCategory(input: $input) {
      errors {
        message
      }
      account {
        id
        notificationSettings {
          push {
            enabled
            disabledCategories
          }
        }
      }
    }
  }
`

export const NotificationCategories = {
  Payments: "Payments",
  Circles: "Circles",
  Price: "Price",
  Marketing: "Marketing",
} as const

const CategoryIcons: Record<NotificationCategoryType, IconNamesType> = {
  Payments: "receive",
  Circles: "people",
  Price: "graph",
  Marketing: "upgrade",
}

type NotificationCategoryType =
  (typeof NotificationCategories)[keyof typeof NotificationCategories]

export const NotificationSettingsScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const isAuthed = useIsAuthed()
  const { data } = useNotificationSettingsQuery({
    fetchPolicy: "cache-first",
    skip: !isAuthed,
  })

  const accountId = data?.me?.defaultAccount?.id
  const notificationSettings = data?.me?.defaultAccount?.notificationSettings

  const [enableNotificationCategory] = useAccountEnableNotificationCategoryMutation({
    optimisticResponse:
      accountId && notificationSettings
        ? (vars) =>
            optimisticEnableCategoryResponse({
              notificationSettings,
              accountId,
              category: vars.input.category,
            })
        : undefined,
  })

  const [disableNotificationCategory] = useAccountDisableNotificationCategoryMutation({
    optimisticResponse:
      accountId && notificationSettings
        ? (vars) =>
            optimisticDisableCategoryResponse({
              notificationSettings,
              accountId,
              category: vars.input.category,
            })
        : undefined,
  })

  const pushNotificationCategoryEnabled = (category: NotificationCategoryType) => {
    return !notificationSettings?.push.disabledCategories.includes(category)
  }

  const toggleCategory = async (
    category: string,
    enabled: boolean,
    channel: NotificationChannel,
  ) => {
    if (enabled) {
      await enableNotificationCategory({
        variables: {
          input: {
            category,
            channel,
          },
        },
      })
    } else {
      await disableNotificationCategory({
        variables: {
          input: {
            category,
            channel,
          },
        },
      })
    }
  }

  const categoriesArray = Object.values(NotificationCategories)

  const NotificationRow: React.FC<{ category: NotificationCategoryType }> = ({
    category,
  }) => (
    <ListItem containerStyle={styles.listItemContainer}>
      <GaloyIcon name={CategoryIcons[category]} size={24} />
      <ListItem.Content>
        <ListItem.Title>
          <Text type="p2">
            {LL.NotificationSettingsScreen.notificationCategories[category].title()}
          </Text>
        </ListItem.Title>
      </ListItem.Content>
      <Switch
        value={pushNotificationCategoryEnabled(category)}
        onValueChange={(value) =>
          toggleCategory(category, value, NotificationChannel.Push)
        }
      />
    </ListItem>
  )
  NotificationRow.displayName = "NotificationRow"

  const pushNotificationSettings = categoriesArray.map((category) => {
    const NotificationRowWithCategory: React.FC = () => (
      <NotificationRow category={category} />
    )
    NotificationRowWithCategory.displayName = `NotificationRow-${category}`
    return NotificationRowWithCategory
  })

  return (
    <Screen style={styles.container} preset="scroll">
      <SettingsGroup items={pushNotificationSettings} />
      <SettingsGroup
        name={LL.NotificationSettingsScreen.splashGroup()}
        items={[SplashToggleRow, SplashMinimumRow]}
      />
    </Screen>
  )
}

const SplashToggleRow: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { enabled, minSats, setEnabled } = useSplashSettings()

  return (
    <ListItem containerStyle={styles.listItemContainer}>
      <GaloyIcon name="receive" size={24} />
      <ListItem.Content>
        <ListItem.Title>
          <Text type="p2">
            {LL.NotificationSettingsScreen.incomingTransactionSplash()}
          </Text>
        </ListItem.Title>
      </ListItem.Content>
      <Switch
        value={enabled}
        onValueChange={(value) => {
          setEnabled(value)
          toastSplashSetting({ enabled: value, LL })
          logIncomingTransactionSplashSettingChanged({
            enabled: value,
            minimumSats: minSats,
            source: "settings",
          })
        }}
      />
    </ListItem>
  )
}

const SplashMinimumRow: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const { enabled, minSats, setMinSats } = useSplashSettings()
  const [draft, setDraft] = React.useState(String(minSats))

  const commit = () => {
    const value = Number.parseInt(draft, 10)
    if (Number.isFinite(value) && value >= 0) {
      setMinSats(value)
      logIncomingTransactionSplashSettingChanged({
        enabled,
        minimumSats: value,
        source: "settings",
      })
      return
    }
    setDraft(String(minSats))
  }

  if (!enabled) return null

  return (
    <ListItem containerStyle={styles.listItemContainer}>
      <ListItem.Content>
        <ListItem.Title>
          <Text type="p2">{LL.NotificationSettingsScreen.splashMinimum()}</Text>
        </ListItem.Title>
      </ListItem.Content>
      <TextInput
        style={styles.minimumInput}
        value={draft}
        onChangeText={setDraft}
        onEndEditing={commit}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
      />
    </ListItem>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 20,
  },
  listItemContainer: {
    backgroundColor: colors.transparent,
  },
  minimumInput: {
    minWidth: 72,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.grey5,
    color: colors.black,
    fontSize: 16,
    textAlign: "right",
  },
}))

const optimisticEnableCategoryResponse = ({
  notificationSettings,
  accountId,
  category,
}: {
  notificationSettings: NotificationSettings
  accountId: string
  category: string
}) => {
  return {
    accountEnableNotificationCategory: {
      account: {
        id: accountId,
        notificationSettings: {
          push: {
            enabled: true,
            disabledCategories: notificationSettings.push.disabledCategories.filter(
              (c) => c !== category,
            ),
            __typename: "NotificationChannelSettings",
          },
          __typename: "NotificationSettings",
        },
        __typename: "ConsumerAccount",
      },
      errors: [],
      __typename: "AccountUpdateNotificationSettingsPayload",
    },
    __typename: "Mutation",
  } as AccountEnableNotificationCategoryMutation
}

const optimisticDisableCategoryResponse = ({
  notificationSettings,
  accountId,
  category,
}: {
  notificationSettings: NotificationSettings
  accountId: string
  category: string
}) => {
  return {
    accountDisableNotificationCategory: {
      account: {
        id: accountId,
        notificationSettings: {
          push: {
            enabled: true,
            disabledCategories: [
              ...notificationSettings.push.disabledCategories,
              category,
            ],
            __typename: "NotificationChannelSettings",
          },
          __typename: "NotificationSettings",
        },
        __typename: "ConsumerAccount",
      },
      errors: [],
      __typename: "AccountUpdateNotificationSettingsPayload",
    },
    __typename: "Mutation",
  } as AccountDisableNotificationCategoryMutation
}
