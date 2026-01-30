import { useEffect, useRef } from "react";
import { Dimensions, View } from "react-native";
import { Callout, CalloutSubview, Marker, } from "react-native-maps";
import { useI18nContext } from "@app/i18n/i18n-react";
import { isIos } from "@app/utils/helper";
import { Text, makeStyles } from "@rn-vui/themed";
export default function MapMarkerComponent(_a) {
    var item = _a.item, color = _a.color, handleMarkerPress = _a.handleMarkerPress, handleCalloutPress = _a.handleCalloutPress, isFocused = _a.isFocused;
    var ref = useRef(null);
    var LL = useI18nContext().LL;
    var styles = useStyles();
    useEffect(function () {
        if (isFocused && ref.current) {
            ref.current.showCallout();
        }
    }, [isFocused]);
    return (<Marker id={item.username} ref={ref} coordinate={item.mapInfo.coordinates} pinColor={color} onPress={function () {
            return handleMarkerPress(item, isIos && ref.current ? ref.current : undefined);
        }} stopPropagation>
      <Callout tooltip onPress={function () { return handleCalloutPress(item); }}>
        {isFocused && (<View style={styles.border}>
            <View style={styles.customView}>
              <Text type="h1" style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                {item.mapInfo.title}
              </Text>
              {isIos ? (<CalloutSubview onPress={function () { return handleCalloutPress(item); }}>
                  <View style={styles.pseudoButton}>
                    <Text style={styles.text}>{LL.MapScreen.payBusiness()}</Text>
                  </View>
                </CalloutSubview>) : (<View style={styles.pseudoButton}>
                  <Text style={styles.text}>{LL.MapScreen.payBusiness()}</Text>
                </View>)}
            </View>
          </View>)}
      </Callout>
    </Marker>);
}
var screenWidth = Dimensions.get("window").width;
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        border: {
            maxWidth: screenWidth,
            overflow: "hidden",
            borderRadius: 3,
            borderWidth: 1,
            borderColor: colors.grey4,
            padding: 10,
            backgroundColor: colors.white,
        },
        customView: {
            alignItems: "center",
            rowGap: 10,
        },
        pseudoButton: {
            backgroundColor: colors.primary3,
            borderRadius: 25,
            width: 200,
        },
        map: {
            height: "100%",
            width: "100%",
        },
        title: { color: colors.black, textAlign: "center" },
        text: {
            fontSize: 20,
            lineHeight: 24,
            fontWeight: "600",
            color: colors.white,
            margin: 8,
            textAlign: "center",
        },
    });
});
//# sourceMappingURL=index.js.map