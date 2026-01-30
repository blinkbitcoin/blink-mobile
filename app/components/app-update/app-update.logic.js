export var isUpdateAvailableOrRequired = function (_a) {
    var _b, _c, _d, _e;
    var buildNumber = _a.buildNumber, mobileVersions = _a.mobileVersions, OS = _a.OS;
    if (!mobileVersions) {
        return {
            required: false,
            available: false,
        };
    }
    // we need to use the modulo because the build number is not the same across ABI
    // and we are multiple by a factor of 10000000 to differentiate between platforms
    // https://github.com/GaloyMoney/galoy-mobile/blob/c971ace92e420e8f90cab209cb9e2c341b71ab42/android/app/build.gradle#L145
    var buildNumberNoAbi = buildNumber % 10000000;
    var minSupportedVersion = (_c = (_b = mobileVersions.find(function (mobileVersion) { return (mobileVersion === null || mobileVersion === void 0 ? void 0 : mobileVersion.platform) === OS; })) === null || _b === void 0 ? void 0 : _b.minSupported) !== null && _c !== void 0 ? _c : NaN;
    var currentSupportedVersion = (_e = (_d = mobileVersions.find(function (mobileVersion) { return (mobileVersion === null || mobileVersion === void 0 ? void 0 : mobileVersion.platform) === OS; })) === null || _d === void 0 ? void 0 : _d.currentSupported) !== null && _e !== void 0 ? _e : NaN;
    return {
        required: buildNumberNoAbi < minSupportedVersion,
        available: buildNumberNoAbi < currentSupportedVersion,
    };
};
//# sourceMappingURL=app-update.logic.js.map