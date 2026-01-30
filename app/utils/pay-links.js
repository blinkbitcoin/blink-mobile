export var getPosUrl = function (posUrl, address) {
    return "".concat(posUrl, "/").concat(address);
};
export var getPrintableQrCodeUrl = function (posUrl, address) {
    return "".concat(posUrl, "/").concat(address, "/print");
};
export var getLightningAddress = function (lnAddressHostname, address) {
    return "".concat(address, "@").concat(lnAddressHostname);
};
//# sourceMappingURL=pay-links.js.map