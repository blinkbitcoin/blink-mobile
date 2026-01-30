import { resolveGaloyInstanceOrDefault, GALOY_INSTANCES } from "@app/config";
it("get a full object with BBW", function () {
    var res = resolveGaloyInstanceOrDefault({ id: "Main" });
    expect(res).toBe(GALOY_INSTANCES[0]);
});
it("get a full object with Staging", function () {
    var res = resolveGaloyInstanceOrDefault({ id: "Staging" });
    expect(res).toBe(GALOY_INSTANCES[1]);
});
it("get a full object with Custom", function () {
    var CustomInstance = {
        id: "Custom",
        name: "Custom",
        graphqlUri: "https://api.custom.com/graphql",
        graphqlWsUri: "ws://ws.custom.com/graphql",
        authUrl: "https://api.custom.com",
        posUrl: "https://pay.custom.com/",
        kycUrl: "https://kyc.custom.com/",
        fiatUrl: "https://fiat.custom.com/",
        lnAddressHostname: "custom.com",
        blockExplorer: "https://mempool.space/tx/",
    };
    var res = resolveGaloyInstanceOrDefault(CustomInstance);
    expect(res).toBe(CustomInstance);
});
//# sourceMappingURL=galoy-instances.spec.js.map