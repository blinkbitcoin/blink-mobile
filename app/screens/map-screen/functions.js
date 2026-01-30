import { PERMISSIONS } from "react-native-permissions";
import { isIos } from "@app/utils/helper";
import Geolocation from "@react-native-community/geolocation";
export var LOCATION_PERMISSION = isIos
    ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
    : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
export var getUserRegion = function (callback) {
    try {
        Geolocation.getCurrentPosition(function (data) {
            if (data) {
                var region = {
                    latitude: data.coords.latitude,
                    longitude: data.coords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                };
                callback(region);
            }
        }, function () {
            callback(undefined);
        }, { timeout: 5000 });
    }
    catch (e) {
        callback(undefined);
    }
};
//# sourceMappingURL=functions.js.map