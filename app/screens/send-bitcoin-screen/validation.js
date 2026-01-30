export var isDestinationLightningPayment = function (destination) {
    return (destination.toLocaleLowerCase().startsWith("lnbc") ||
        destination.toLocaleLowerCase().startsWith("lntb"));
};
export var isDestinationNetworkValid = function (destination, network) {
    return ((network === "signet" && destination.toLowerCase().startsWith("lntb")) ||
        (network === "mainnet" && destination.toLowerCase().startsWith("lnbc")));
};
//# sourceMappingURL=validation.js.map