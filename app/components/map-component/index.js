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
import debounce from "lodash.debounce";
import React, { useRef } from "react";
import { View } from "react-native";
import MapView from "react-native-maps";
import { RESULTS, request } from "react-native-permissions";
import { useApolloClient } from "@apollo/client";
import { updateMapLastCoords } from "@app/graphql/client-only-query";
import { LOCATION_PERMISSION, getUserRegion } from "@app/screens/map-screen/functions";
import { isIOS } from "@rn-vui/base";
import { makeStyles, useTheme } from "@rn-vui/themed";
import MapMarkerComponent from "../map-marker-component";
import LocationButtonCopy from "./location-button-copy";
import MapStyles from "./map-styles.json";
import { OpenSettingsModal } from "./open-settings-modal";
export default function MapComponent(_a) {
    var _this = this;
    var _b;
    var data = _a.data, userLocation = _a.userLocation, permissionsStatus = _a.permissionsStatus, setPermissionsStatus = _a.setPermissionsStatus, handleMapPress = _a.handleMapPress, handleMarkerPress = _a.handleMarkerPress, focusedMarker = _a.focusedMarker, focusedMarkerRef = _a.focusedMarkerRef, handleCalloutPress = _a.handleCalloutPress, alertOnLocationError = _a.alertOnLocationError;
    var _c = useTheme().theme, colors = _c.colors, themeMode = _c.mode;
    var styles = useStyles();
    var client = useApolloClient();
    var mapViewRef = useRef(null);
    var openSettingsModalRef = React.useRef(null);
    var isAndroidSecondPermissionRequest = React.useRef(false);
    // toggle modal from inside modal component instead of here in the parent
    var toggleModal = React.useCallback(function () { var _a; return (_a = openSettingsModalRef.current) === null || _a === void 0 ? void 0 : _a.toggleVisibility(); }, []);
    var respondToBlocked = function (status) {
        // iOS will only ever ask once for permission, and initial checks can differentiate between BLOCKED vs DENIED
        if (isIOS) {
            if (permissionsStatus === RESULTS.BLOCKED && status === RESULTS.BLOCKED) {
                toggleModal();
            }
            // Android can ask twice for permission, and initial checks cannot differentiate between BLOCKED vs DENIED
        }
        else {
            !isAndroidSecondPermissionRequest.current && toggleModal();
        }
    };
    var centerOnUser = function () { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            getUserRegion(function (region) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    if (region && mapViewRef.current) {
                        mapViewRef.current.animateToRegion(region);
                    }
                    else {
                        alertOnLocationError();
                    }
                    return [2 /*return*/];
                });
            }); });
            return [2 /*return*/];
        });
    }); };
    var requestLocationPermission = function () { return __awaiter(_this, void 0, void 0, function () {
        var status_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, request(LOCATION_PERMISSION, function () {
                            return new Promise(function (resolve) {
                                // This will only trigger on Android if it's the 2nd request ever
                                isAndroidSecondPermissionRequest.current = true;
                                resolve(true);
                            });
                        })];
                case 1:
                    status_1 = _b.sent();
                    if (status_1 === RESULTS.GRANTED) {
                        centerOnUser();
                    }
                    else if (status_1 === RESULTS.BLOCKED) {
                        respondToBlocked(status_1);
                    }
                    isAndroidSecondPermissionRequest.current = false;
                    setPermissionsStatus(status_1);
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    alertOnLocationError();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var debouncedHandleRegionChange = React.useRef(debounce(function (region) { return updateMapLastCoords(client, region); }, 1000, {
        trailing: true,
    })).current;
    return (<View style={styles.viewContainer}>
      <MapView ref={mapViewRef} style={styles.map} showsUserLocation={permissionsStatus === RESULTS.GRANTED} showsMyLocationButton={false} initialRegion={userLocation} customMapStyle={themeMode === "dark" ? MapStyles.dark : MapStyles.light} onPress={handleMapPress} onRegionChange={debouncedHandleRegionChange} onMarkerSelect={function (e) {
            // react-native-maps has a very annoying error on iOS
            // When two markers are almost on top of each other onSelect will get called for a nearby Marker
            // This improvement (not an optimal fix) checks to see if that error happened, and quickly reopens the correct callout
            var matchingLat = e.nativeEvent.coordinate.latitude ===
                (focusedMarker === null || focusedMarker === void 0 ? void 0 : focusedMarker.mapInfo.coordinates.latitude);
            var matchingLng = e.nativeEvent.coordinate.longitude ===
                (focusedMarker === null || focusedMarker === void 0 ? void 0 : focusedMarker.mapInfo.coordinates.longitude);
            if (!matchingLat || !matchingLng) {
                if (focusedMarkerRef.current) {
                    focusedMarkerRef.current.showCallout();
                }
            }
        }}>
        {((_b = data === null || data === void 0 ? void 0 : data.businessMapMarkers) !== null && _b !== void 0 ? _b : []).map(function (item) { return (<MapMarkerComponent key={item.username} item={item} color={colors._orange} handleCalloutPress={handleCalloutPress} handleMarkerPress={handleMarkerPress} isFocused={(focusedMarker === null || focusedMarker === void 0 ? void 0 : focusedMarker.username) === item.username}/>); })}
      </MapView>
      {permissionsStatus !== RESULTS.UNAVAILABLE &&
            permissionsStatus !== RESULTS.LIMITED && (<LocationButtonCopy requestPermissions={requestLocationPermission} permissionStatus={permissionsStatus} centerOnUser={centerOnUser}/>)}
      <OpenSettingsModal ref={openSettingsModalRef}/>
    </View>);
}
var useStyles = makeStyles(function () { return ({
    map: {
        height: "100%",
        width: "100%",
    },
    viewContainer: { flex: 1 },
}); });
//# sourceMappingURL=index.js.map