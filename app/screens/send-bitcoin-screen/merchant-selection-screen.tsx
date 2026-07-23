import React, { useCallback, useState } from "react"
import { FlatList, Pressable, View } from "react-native"
import { RouteProp, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { testProps } from "@app/utils/testProps"

import { MerchantChoice } from "./payment-destination/index.types"

type Props = {
  route: RouteProp<RootStackParamList, "merchantSelection">
}

const iconForMerchant = (merchant: MerchantChoice) =>
  merchant.category === "swap" ? "coins" : "storefront"

export const MerchantSelectionScreen: React.FC<Props> = ({ route }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "merchantSelection">>()
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null)

  const handleMerchantPress = useCallback(
    (merchant: MerchantChoice) => {
      setSelectedMerchantId(merchant.id)
      setTimeout(() => {
        navigation.replace("sendBitcoinDestination", { payment: merchant.lnurl })
      }, 0)
    },
    [navigation],
  )

  const renderMerchant = useCallback(
    ({ item, index }: { item: MerchantChoice; index: number }) => {
      const isSelected = item.id === selectedMerchantId
      const title = item.title || item.companyName
      const description = item.description
      const accessibilityLabel = `${title}. ${description}`

      return (
        <Pressable
          {...testProps(`merchant-${item.id}`)}
          accessibilityLabel={accessibilityLabel}
          onPress={() => handleMerchantPress(item)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View {...testProps(`merchant-${item.id}-icon`)} style={styles.iconContainer}>
            <GaloyIcon
              name={iconForMerchant(item)}
              size={24}
              color={colors.primary}
              weight="bold"
            />
          </View>
          <View style={styles.textContainer}>
            <Text
              {...testProps(`merchant-${index}-title`)}
              style={styles.title}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            <Text
              {...testProps(`merchant-${index}-description`)}
              style={styles.description}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {description}
            </Text>
          </View>
          {isSelected ? (
            <View {...testProps(`merchant-${item.id}-selected`)}>
              <GaloyIcon name="check" size={22} color={colors._green} weight="bold" />
            </View>
          ) : (
            <View style={styles.checkPlaceholder} />
          )}
        </Pressable>
      )
    },
    [colors._green, colors.primary, handleMerchantPress, selectedMerchantId, styles],
  )

  return (
    <View {...testProps("merchant-selection-screen")} style={styles.container}>
      <FlatList
        data={route.params.merchants}
        keyExtractor={(merchant) => merchant.id}
        renderItem={renderMerchant}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{LL.MerchantSelectionScreen.empty()}</Text>
        }
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 76,
    paddingVertical: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    alignItems: "center",
    backgroundColor: colors.grey6,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginRight: 14,
    width: 48,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: colors.black,
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  description: {
    color: colors.grey1,
    fontSize: 14,
    lineHeight: 19,
  },
  checkPlaceholder: {
    width: 22,
  },
  separator: {
    backgroundColor: colors.grey4,
    height: 1,
    marginLeft: 62,
  },
  emptyText: {
    color: colors.grey1,
    fontSize: 16,
    marginTop: 32,
    textAlign: "center",
  },
}))

export default MerchantSelectionScreen
