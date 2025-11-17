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
import {
  Divider,
  Icon,
  ListItem,
  makeStyles,
  Switch,
  Text,
  useTheme,
} from "@rn-vui/themed"

import { Screen } from "../../components/screen"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"

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
  const {
    theme: { colors },
  } = useTheme()

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

  const categoriesArray = Object.values(NotificationCategories)

  const pushNotificationSettings = categoriesArray.map((category, index) => {
    const isLast = index === categoriesArray.length - 1

    return (
      <React.Fragment key={category}>
        <ListItem containerStyle={styles.listItemContainer}>
          <GaloyIcon name={CategoryIcons[category]} size={22} />
          <ListItem.Content>
            <ListItem.Title>
              {LL.NotificationSettingsScreen.notificationCategories[category].title()}
            </ListItem.Title>
          </ListItem.Content>
          <Switch
            value={pushNotificationCategoryEnabled(category)}
            onValueChange={(value) =>
              toggleCategory(category, value, NotificationChannel.Push)
            }
          />
        </ListItem>
        {!isLast && <Divider color={colors.grey4} />}
      </React.Fragment>
    )
  })

  return (
    <Screen style={styles.container} preset="scroll">
      <View style={styles.settingsHeader}>
        <View style={styles.notificationHeader}>
          <Icon name={"notifications-outline"} size={22} type="ionicon" />
          <Text type="p2">{LL.NotificationSettingsScreen.pushNotifications()}</Text>
        </View>
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
      </View>

      {pushNotificationsEnabled && (
        <>
          <Text type="p3" style={styles.preferencesText}>{LL.common.preferences()}</Text>
          <View style={styles.settingsBody}>{pushNotificationSettings}</View>
        </>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    padding: 20,
  },
  settingsHeader: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  preferencesText: {
    marginTop: 20,
    marginBottom: 10,
  },
  settingsBody: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 5,
  },
  listItemContainer: {
    backgroundColor: colors.transparent,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
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
