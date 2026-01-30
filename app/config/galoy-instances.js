import { TurboModuleRegistry, NativeModules } from "react-native";
// this is used for local development
// will typically return localhost
var scriptHostname = function () {
    var _a, _b, _c;
    var turboModule = TurboModuleRegistry.getEnforcing("SourceCode");
    var turboScriptURL = (_b = (_a = turboModule === null || turboModule === void 0 ? void 0 : turboModule.getConstants) === null || _a === void 0 ? void 0 : _a.call(turboModule)) === null || _b === void 0 ? void 0 : _b.scriptURL;
    var scriptURL = (NativeModules.SourceCode || {}).scriptURL;
    var urlToUse = turboScriptURL || scriptURL;
    if (!urlToUse) {
        return "localhost";
    }
    var parts = urlToUse.split("://");
    if (parts.length < 2) {
        return "localhost";
    }
    var hostPart = (_c = parts[1]) === null || _c === void 0 ? void 0 : _c.split(":")[0];
    return hostPart !== null && hostPart !== void 0 ? hostPart : "localhost";
};
export var possibleGaloyInstanceNames = ["Main", "Staging", "Local", "Custom"];
export var resolveGaloyInstanceOrDefault = function (input) {
    if (input.id === "Custom") {
        return input;
    }
    var instance = GALOY_INSTANCES.find(function (instance) { return instance.id === input.id; });
    // branch only to please typescript. Array,find have T | undefined as return type
    if (instance === undefined) {
        console.error("instance not found"); // should not happen
        return GALOY_INSTANCES[0];
    }
    return instance;
};
export var GALOY_INSTANCES = [
    {
        id: "Main",
        name: "Blink",
        graphqlUri: "https://api.blink.sv/graphql",
        graphqlWsUri: "wss://ws.blink.sv/graphql",
        authUrl: "https://api.blink.sv",
        posUrl: "https://pay.blink.sv",
        kycUrl: "https://kyc.blink.sv",
        lnAddressHostname: "blink.sv",
        blockExplorer: "https://mempool.space/tx/",
        fiatUrl: "https://fiat.blink.sv",
    },
    {
        id: "Staging",
        name: "Staging",
        graphqlUri: "https://api.staging.blink.sv/graphql",
        graphqlWsUri: "wss://ws.staging.blink.sv/graphql",
        authUrl: "https://api.staging.blink.sv",
        posUrl: "https://pay.staging.blink.sv",
        kycUrl: "https://kyc.staging.blink.sv",
        lnAddressHostname: "pay.staging.blink.sv",
        blockExplorer: "https://mempool.space/signet/tx/",
        fiatUrl: "https://fiat.staging.blink.sv",
    },
    {
        id: "Local",
        name: "Local",
        graphqlUri: "http://".concat(scriptHostname(), ":4455/graphql"),
        graphqlWsUri: "ws://".concat(scriptHostname(), ":4455/graphqlws"),
        authUrl: "http://".concat(scriptHostname(), ":4455"),
        posUrl: "http://".concat(scriptHostname(), ":3000"),
        kycUrl: "http://".concat(scriptHostname(), ":3000"),
        lnAddressHostname: "".concat(scriptHostname(), ":3000"),
        blockExplorer: "https://mempool.space/signet/tx/",
        fiatUrl: "http://".concat(scriptHostname(), ":3000"),
    },
];
//# sourceMappingURL=galoy-instances.js.map