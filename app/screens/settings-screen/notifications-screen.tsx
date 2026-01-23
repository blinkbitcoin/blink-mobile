import * as React from "react"

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
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  listItemContainer: {
    backgroundColor: colors.transparent,
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
