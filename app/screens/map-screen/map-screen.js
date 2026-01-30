var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import * as React from "react";
// eslint-disable-next-line react-native/split-platform-components
import { Alert, Dimensions } from "react-native";
import { check, RESULTS } from "react-native-permissions";
import { gql } from "@apollo/client";
import MapComponent from "@app/components/map-component";
import { useBusinessMapMarkersQuery, useRegionQuery, } from "@app/graphql/generated";
import { useIsAuthed } from "@app/graphql/is-authed-context";
import useDeviceLocation from "@app/hooks/use-device-location";
import { useI18nContext } from "@app/i18n/i18n-react";
import Geolocation from "@react-native-community/geolocation";
import { useFocusEffect } from "@react-navigation/native";
import countryCodes from "../../../utils/countryInfo.json";
import { Screen } from "../../components/screen";
import { toastShow } from "../../utils/toast";
import { LOCATION_PERMISSION, getUserRegion } from "./functions";
var EL_ZONTE_COORDS = {
    latitude: 13.496743,
    longitude: -89.439462,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
};
// essentially calculates zoom for location being set based on country
var _a = Dimensions.get("window"), height = _a.height, width = _a.width;
var LATITUDE_DELTA = 15; // <-- decrease for more zoom
var LONGITUDE_DELTA = LATITUDE_DELTA * (width / height);
Geolocation.setRNConfiguration({
    skipPermissionRequests: true,
    enableBackgroundLocationUpdates: false,
    authorizationLevel: "whenInUse",
    locationProvider: "auto",
});
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query businessMapMarkers {\n    businessMapMarkers {\n      username\n      mapInfo {\n        title\n        coordinates {\n          longitude\n          latitude\n        }\n      }\n    }\n  }\n"], ["\n  query businessMapMarkers {\n    businessMapMarkers {\n      username\n      mapInfo {\n        title\n        coordinates {\n          longitude\n          latitude\n        }\n      }\n    }\n  }\n"])));
export var MapScreen = function (_a) {
    var navigation = _a.navigation;
    var isAuthed = useIsAuthed();
    var _b = useDeviceLocation(), countryCode = _b.countryCode, loading = _b.loading;
    var _c = useRegionQuery(), lastRegion = _c.data, lastRegionError = _c.error;
    var LL = useI18nContext().LL;
    var _d = useBusinessMapMarkersQuery({
        notifyOnNetworkStatusChange: true,
        fetchPolicy: "cache-and-network",
    }), data = _d.data, error = _d.error, refetch = _d.refetch;
    var focusedMarkerRef = React.useRef(null);
    var _e = React.useState(), initialLocation = _e[0], setInitialLocation = _e[1];
    var _f = React.useState(false), isRefreshed = _f[0], setIsRefreshed = _f[1];
    var _g = React.useState(null), focusedMarker = _g[0], setFocusedMarker = _g[1];
    var _h = React.useState(true), isInitializing = _h[0], setInitializing = _h[1];
    var _j = React.useState(), permissionsStatus = _j[0], setPermissionsStatus = _j[1];
    useFocusEffect(function () {
        if (!isRefreshed) {
            setIsRefreshed(true);
            refetch();
        }
    });
    if (error) {
        toastShow({ message: error.message, LL: LL });
    }
    // On screen load, check (NOT request) if location permissions are given
    React.useEffect(function () {
        ;
        (function () { return __awaiter(void 0, void 0, void 0, function () {
            var status;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, check(LOCATION_PERMISSION)];
                    case 1:
                        status = _a.sent();
                        setPermissionsStatus(status);
                        if (status === RESULTS.GRANTED) {
                            getUserRegion(function (region) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    if (region) {
                                        setInitialLocation(region);
                                    }
                                    else {
                                        setInitializing(false);
                                    }
                                    return [2 /*return*/];
                                });
                            }); });
                        }
                        else {
                            setInitializing(false);
                        }
                        return [2 /*return*/];
                }
            });
        }); })();
    }, []);
    var alertOnLocationError = React.useCallback(function () {
        Alert.alert(LL.common.error(), LL.MapScreen.error());
    }, [LL]);
    React.useEffect(function () {
        if (lastRegionError) {
            setInitializing(false);
            setInitialLocation(EL_ZONTE_COORDS);
            alertOnLocationError();
        }
    }, [lastRegionError, alertOnLocationError]);
    // Flow when location permissions are denied
    React.useEffect(function () {
        if (countryCode && lastRegion && !isInitializing && !loading && !initialLocation) {
            // User has used map before, so we use their last viewed coords
            if (lastRegion.region) {
                var _a = lastRegion.region, latitude = _a.latitude, longitude = _a.longitude, latitudeDelta = _a.latitudeDelta, longitudeDelta = _a.longitudeDelta;
                var region = {
                    latitude: latitude,
                    longitude: longitude,
                    latitudeDelta: latitudeDelta,
                    longitudeDelta: longitudeDelta,
                };
                setInitialLocation(region);
                // User is using maps for the first time, so we center on the center of their IP's country
            }
            else {
                // JSON 'hashmap' with every countrys' code listed with their lat and lng
                var countryCodesToCoords = JSON.parse(JSON.stringify(countryCodes));
                var countryCoords = countryCodesToCoords.data[countryCode];
                if (countryCoords) {
                    var region = {
                        latitude: countryCoords.lat,
                        longitude: countryCoords.lng,
                        latitudeDelta: LATITUDE_DELTA,
                        longitudeDelta: LONGITUDE_DELTA,
                    };
                    setInitialLocation(region);
                    // backup if country code is not recognized
                }
                else {
                    setInitialLocation(EL_ZONTE_COORDS);
                }
            }
        }
    }, [isInitializing, countryCode, lastRegion, loading, initialLocation]);
    var handleCalloutPress = function (item) {
        if (isAuthed) {
            navigation.navigate("sendBitcoinDestination", { username: item.username });
        }
        else {
            navigation.navigate("acceptTermsAndConditions", { flow: "phone" });
        }
    };
    var handleMarkerPress = function (item, ref) {
        setFocusedMarker(item);
        if (ref) {
            focusedMarkerRef.current = ref;
        }
    };
    var handleMapPress = function () {
        setFocusedMarker(null);
        focusedMarkerRef.current = null;
    };
    return (<Screen>
      {initialLocation && (<MapComponent data={data} userLocation={initialLocation} permissionsStatus={permissionsStatus} setPermissionsStatus={setPermissionsStatus} handleMapPress={handleMapPress} handleMarkerPress={handleMarkerPress} focusedMarker={focusedMarker} focusedMarkerRef={focusedMarkerRef} handleCalloutPress={handleCalloutPress} alertOnLocationError={alertOnLocationError}/>)}
    </Screen>);
};
var templateObject_1;
//# sourceMappingURL=map-screen.js.map