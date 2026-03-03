import {
  NotificationChannel,
  NotificationSettings,
  useAccountDisableNotificationCategoryMutation,
  useAccountEnableNotificationCategoryMutation,
  useNotificationSettingsQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

export const NotificationCategory = {
  Payments: "Payments",
  Marketing: "Marketing",
}

type NotificationCategoryType =
  (typeof NotificationCategory)[keyof typeof NotificationCategory]

type BuildAccountPayloadParams = {
  notificationSettings: NotificationSettings
  accountId: string
  category: string
  enabled: boolean
}

const buildAccountPayload = ({
  notificationSettings,
  accountId,
  category,
  enabled,
}: BuildAccountPayloadParams) => {
  const disabledCategories = enabled
    ? notificationSettings.push.disabledCategories.filter((c) => c !== category)
    : [...notificationSettings.push.disabledCategories, category]

  return {
    account: {
      id: accountId,
      notificationSettings: {
        push: {
          enabled: true,
          disabledCategories,
          __typename: "NotificationChannelSettings" as const,
        },
        __typename: "NotificationSettings" as const,
      },
      __typename: "ConsumerAccount" as const,
    },
    errors: [],
    __typename: "AccountUpdateNotificationSettingsPayload" as const,
  }
}

export const useNotificationToggle = () => {
  const { LL } = useI18nContext()
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
        ? ({ input }) => ({
            accountEnableNotificationCategory: buildAccountPayload({
              notificationSettings,
              accountId,
              category: input.category,
              enabled: true,
            }),
            __typename: "Mutation",
          })
        : undefined,
  })

  const [disableNotificationCategory] = useAccountDisableNotificationCategoryMutation({
    optimisticResponse:
      accountId && notificationSettings
        ? ({ input }) => ({
            accountDisableNotificationCategory: buildAccountPayload({
              notificationSettings,
              accountId,
              category: input.category,
              enabled: false,
            }),
            __typename: "Mutation",
          })
        : undefined,
  })

  const isCategoryEnabled = (category: NotificationCategoryType) =>
    notificationSettings?.push.disabledCategories
      ? !notificationSettings.push.disabledCategories.includes(category)
      : false

  const toggleCategory = async (category: NotificationCategoryType, enabled: boolean) => {
    try {
      const mutation = enabled ? enableNotificationCategory : disableNotificationCategory
      await mutation({
        variables: { input: { category, channel: NotificationChannel.Push } },
      })
    } catch {
      toastShow({
        message: LL.CardFlow.CardSettings.notificationToggleError(),
        type: "warning",
        LL,
      })
    }
  }

  return { isCategoryEnabled, toggleCategory }
}
