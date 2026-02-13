import { FC } from "react"
import { View, TouchableOpacity, Platform, Linking } from "react-native"
import { makeStyles, Skeleton, Text, useTheme } from "@rn-vui/themed"
import Icon from "react-native-vector-icons/Ionicons"

import { useI18nContext } from "@app/i18n/i18n-react.tsx"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IMarker } from "@app/screens/map-screen/btc-map-interface.ts"
import { usePlace } from "@app/components/map-components/map-hooks/use-place.ts"
import {
  categories,
  Category,
  categoryI18NNames,
} from "@app/components/map-components/categories.ts"

type EventContentProps = {
  closeModal: () => void
  selectedMarker: IMarker | null
}

export const EventContent: FC<EventContentProps> = ({ closeModal, selectedMarker }) => {
  const styles = useStyles()

  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()

  // todo handle error
  const { placeData, error, isLoading } = usePlace(selectedMarker?.id)

  const openMap = ({ lat, lng, label }: { lat: string; lng: string; label: string }) => {
    const scheme = Platform.select({
      ios: `maps://?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    })
    if (scheme) {
      try {
        Linking.openURL(scheme)
      } catch (_) {
        /* empty */
      }
    }
  }

  return (
    <View>
      <View style={styles.titleContent}>
        <Text style={styles.titleModal} ellipsizeMode="tail" numberOfLines={1}>
          {/* todo handle missing name field better. maybe skeleton?*/}
          {placeData?.name ?? selectedMarker?.name ?? "An unnamed place"}
        </Text>
        <View style={styles.iconContainer}>
          <Icon color="grey" name="share-social" size={22} style={styles.icon} />
          <Icon
            color="grey"
            name="close"
            size={22}
            style={styles.icon}
            onPress={closeModal}
          />
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <GaloyPrimaryButton
          title={LL.MapScreen.payBusiness()}
          containerStyle={styles.payButton}
          disabled
        />
        <TouchableOpacity
          onPress={() => {
            if (!selectedMarker || !selectedMarker.location || !selectedMarker.name) {
              return
            }
            const { latitude, longitude } = selectedMarker.location

            openMap({
              lat: latitude.toString(),
              lng: longitude.toString(),
              label: selectedMarker.name,
            })
          }}
        >
          <Icon color={colors.black} name="location" size={40} />
        </TouchableOpacity>
      </View>

      <Text style={styles.locationTitle}>
        {selectedMarker?.icon &&
          LL.MapScreen.categories[
            categoryI18NNames[
              (categories[selectedMarker.icon] as Category) ?? Category.Other
            ] as keyof typeof LL.MapScreen.categories
          ]()}
      </Text>
      {isLoading ? (
        <View style={styles.eventDetails}>
          <Skeleton animation="wave" width={200} height={18} />
        </View>
      ) : placeData?.address ? (
        <View style={styles.eventDetails}>
          <Text style={styles.detailsTitle}>{LL.MapScreen.address()}: </Text>
          <Text style={styles.detailsTitle}>{placeData.address}</Text>
        </View>
      ) : null}
      {isLoading ? (
        <View style={styles.eventDetails}>
          <Skeleton animation="wave" width={200} height={18} />
        </View>
      ) : placeData?.phone ? (
        <View style={styles.eventDetails}>
          <Text style={styles.detailsTitle}>{LL.MapScreen.phone()}: </Text>
          <Text style={styles.detailsTitle}>{placeData.phone}</Text>
        </View>
      ) : null}
      {isLoading ? (
        <View style={styles.eventDetails}>
          <Skeleton animation="wave" width={200} height={18} />
        </View>
      ) : placeData?.website ? (
        <View style={styles.eventDetails}>
          <Text style={styles.detailsTitle}>{LL.MapScreen.website()}: </Text>
          <Text style={styles.detailsTitle}>{placeData.website}</Text>
        </View>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  titleContent: {
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  titleModal: {
    flex: 1,
    fontSize: 18,
  },
  locationTitle: {
    flex: 1,
    fontSize: 18,
    textAlign: "center",
    marginVertical: 20,
  },
  eventDetails: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginVertical: 2,
  },
  detailsTitle: {
    fontSize: 16,
  },
  icon: { paddingHorizontal: 1 },
  payButton: {
    flex: 1,
  },
  iconContainer: { flexDirection: "row", gap: 10 },
  buttonContainer: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 15 },
}))
