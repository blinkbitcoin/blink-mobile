import * as React from "react"
import { View } from "react-native"

import { gql } from "@apollo/client"
import {
  AccountDisableNotificationCategoryMutation,
  AccountDisableNotificationChannelMutation,
  AccountEnableNotificationCategoryMutation,
  AccountEnableNotificationChannelMutation,
  NotificationChannel,
  NotificationSettings,
  useAccountDisableNotificationCategoryMutation,
  useAccountDisableNotificationChannelMutation,
  useAccountEnableNotificationCategoryMutation,
  useAccountEnableNotificationChannelMutation,
  useNotificationSettingsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Switch, Text } from "@rneui/themed"

import { Screen } from "../../components/screen"

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

const NotificationCategories = {
  Circles: "Circles",
  Payments: "Payments",
  Price: "Price",
  Marketing: "Marketing",
} as const

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

  const [enableNotificationChannel] = useAccountEnableNotificationChannelMutation({
    optimisticResponse:
      accountId && notificationSettings
        ? () =>
            optimisticEnableChannelResponse({
              notificationSettings,
              accountId,
            })
        : undefined,
  })

  const [disableNotificationChannel] = useAccountDisableNotificationChannelMutation({
    optimisticResponse:
      accountId && notificationSettings
        ? () =>
            optimisticDisableChannelResponse({
              notificationSettings,
              accountId,
            })
        : undefined,
  })

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

  const pushNotificationsEnabled = notificationSettings?.push.enabled

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

  const pushNotificationSettings = Object.values(NotificationCategories).map(
    (category) => {
      return (
        <View style={styles.settingsRow} key={category}>
          <Switch
            value={pushNotificationCategoryEnabled(category)}
            onValueChange={(value) =>
              toggleCategory(category, value, NotificationChannel.Push)
            }
          />
          <Text type="h2">
            {LL.NotificationSettingsScreen.notificationCategories[category].title()}
          </Text>
        </View>
      )
    },
  )

  return (
    <Screen style={styles.container} preset="scroll">
      <View style={styles.settingsHeader}>
        <Switch
          value={pushNotificationsEnabled}
          onValueChange={async (enabled) => {
            if (enabled) {
              await enableNotificationChannel({
                variables: {
                  input: {
                    channel: NotificationChannel.Push,
                  },
                },
              })
            } else {
              await disableNotificationChannel({
                variables: {
                  input: {
                    channel: NotificationChannel.Push,
                  },
                },
              })
            }
          }}
        />
        <Text type="h1">{LL.NotificationSettingsScreen.pushNotifications()}</Text>
      </View>
      {pushNotificationsEnabled && (
        <View style={styles.settingsBody}>{pushNotificationSettings}</View>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    padding: 20,
    rowGap: 20,
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    columnGap: 10,
  },
  settingsBody: {
    marginLeft: 40,
    columnGap: 10,
    rowGap: 20,
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    columnGap: 10,
  },
}))

const optimisticEnableChannelResponse = ({
  notificationSettings,
  accountId,
}: {
  notificationSettings: NotificationSettings
  accountId: string
}) => {
  return {
    accountEnableNotificationChannel: {
      account: {
        id: accountId,
        notificationSettings: {
          push: {
            enabled: true,
            disabledCategories: notificationSettings.push.disabledCategories,
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
  } as AccountEnableNotificationChannelMutation
}

const optimisticDisableChannelResponse = ({
  notificationSettings,
  accountId,
}: {
  notificationSettings: NotificationSettings
  accountId: string
}) => {
  return {
    accountDisableNotificationChannel: {
      account: {
        id: accountId,
        notificationSettings: {
          push: {
            enabled: false,
            disabledCategories: notificationSettings.push.disabledCategories,
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
  } as AccountDisableNotificationChannelMutation
}

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
