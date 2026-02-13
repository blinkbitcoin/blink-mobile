import React from "react"
import { View } from "react-native"
import { Marker } from "react-native-maps"
import MaterialIcon from "react-native-vector-icons/MaterialIcons"

import { IMarker } from "@app/screens/map-screen/btc-map-interface.ts"
import { useStyles } from "@app/components/map-components/index.tsx"
import PinIcon from "@app/components/map-components/pinIcon.tsx"

const MarkerComponent = React.memo(
  ({ pin, onSelect }: { pin: IMarker; onSelect: (pin: IMarker) => void }) => {
    const iconName: string = pin.icon
    const styles = useStyles()
    return (
      <Marker
        identifier={`pin-${pin.id}`}
        coordinate={pin.location}
        onSelect={() => onSelect(pin)}
        tracksViewChanges={false}
      >
        <View style={styles.iconContainer}>
          <PinIcon size={35} />
          <MaterialIcon
            name={iconName}
            size={18}
            color="#FFFFFF"
            style={styles.iconOverlay}
          />
        </View>
      </Marker>
    )
  },
)
MarkerComponent.displayName = "MarkerComponent"

export default MarkerComponent
