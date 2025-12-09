import * as React from "react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import {
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ViewToken,
} from "react-native"
import { useI18nContext } from "@app/i18n/i18n-react"
import QRCode from "react-native-qrcode-svg"
import Logo from "@app/assets/logo/blink-logo-icon.png"
import Icon from "react-native-vector-icons/Ionicons"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"

const { width } = Dimensions.get("window")
const QR_ITEM_WIDTH = width * 0.7

interface QRItem {
  id: string
  address: string
  type: "lightning" | "onchain"
}

export const TopUpScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()

  const [currentIndex, setCurrentIndex] = React.useState(0)

  const qrItems: QRItem[] = [
    {
      id: "1",
      address: "lnbc1dwdja....widjwdawid",
      type: "lightning",
    },
    {
      id: "2",
      address: "bc1qxy2kgd....493p83kkfjhx0wlh",
      type: "onchain",
    },
  ]

  const handleCopy = () => {}

  const handleShare = () => {}

  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index || 0)
      }
    },
  ).current

  const renderQRItem = ({ item }: { item: QRItem }) => (
    <View style={styles.qrSlideContainer}>
      <View style={styles.qrContainer}>
        <QRCode
          value={item.address}
          size={212}
          logoBackgroundColor="white"
          logo={Logo}
          logoSize={40}
          logoMargin={2}
        />
      </View>
    </View>
  )

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <Text type="p1" style={styles.instructionText}>
            {LL.TopUpScreen.qrTitle({ minAmount: "$999" })}
          </Text>

          <FlatList
            data={qrItems}
            renderItem={renderQRItem}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={QR_ITEM_WIDTH}
            decelerationRate="fast"
            contentContainerStyle={styles.qrList}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 50,
            }}
          />

          {qrItems.map((item, index) =>
            index === currentIndex ? (
              <Text key={item.id} type="p2" style={{ marginVertical: 10 }}>
                {item.address}
              </Text>
            ) : null,
          )}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCopy}>
              <Text type="p3">{LL.TopUpScreen.copy()}</Text>
              <GaloyIcon name="copy-paste" size={15} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Text type="p3">{LL.TopUpScreen.share()}</Text>
              <Icon name="share-outline" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder={LL.TopUpScreen.placeholder()}
              keyboardType="numeric"
            />
            <View style={styles.currencyBadge}>
              <Text type="p3" bold style={styles.currencyText}>
                BTC
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingTop: 40,
  },
  contentContainer: {
    alignItems: "center",
  },
  instructionText: {
    marginBottom: 30,
    textAlign: "center",
    color: colors.black,
    paddingHorizontal: 50,
  },
  qrList: {
    paddingHorizontal: (width + 10 - QR_ITEM_WIDTH) / 2,
  },
  qrSlideContainer: {
    width: QR_ITEM_WIDTH - 10,
    alignItems: "center",
  },
  qrContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors._white,
    borderRadius: 10,
    padding: 26,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.grey5,
    borderRadius: 8,
  },
  inputContainer: {
    width: "100%",
    paddingHorizontal: 20,
    position: "relative",
  },
  input: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    color: colors.white,
    fontSize: 16,
    width: "100%",
  },
  currencyBadge: {
    position: "absolute",
    right: 32,
    top: "50%",
    transform: [{ translateY: -14 }],
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
  },
  currencyText: {
    color: colors._black,
    fontWeight: "bold",
  },
}))
