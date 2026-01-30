import React from "react";
import { View } from "react-native";
import ChevronDownIcon from "@app/assets/icons/chevron-down.svg";
import CopyIcon from "@app/assets/icons/copy.svg";
import ErrorIcon from "@app/assets/icons/error.svg";
import InfoIcon from "@app/assets/icons/info.svg";
import MerchantIcon from "@app/assets/icons/merchant.svg";
import NFCIcon from "@app/assets/icons/nfc.svg";
import ReceiveBitcoinIcon from "@app/assets/icons/receive-bitcoin.svg";
import ShareIcon from "@app/assets/icons/share.svg";
import WebLink from "@app/assets/icons/web-link.svg";
export var CustomIcon = function (_a) {
    var name = _a.name, color = _a.color;
    if (name === "custom-receive-bitcoin") {
        return <ReceiveBitcoinIcon color={color}/>;
    }
    if (name === "custom-info-icon") {
        return <InfoIcon color={color}/>;
    }
    if (name === "custom-copy-icon") {
        return <CopyIcon color={color}/>;
    }
    if (name === "custom-share-icon") {
        return <ShareIcon color={color}/>;
    }
    if (name === "custom-error-icon") {
        return <ErrorIcon color={color}/>;
    }
    if (name === "custom-merchant-icon") {
        return <MerchantIcon color={color}/>;
    }
    if (name === "custom-chevron-down-icon") {
        return <ChevronDownIcon color={color}/>;
    }
    if (name === "custom-web-link-icon") {
        return <WebLink color={color}/>;
    }
    if (name === "nfc") {
        return <NFCIcon color={color}/>;
    }
    return <View />;
};
//# sourceMappingURL=custom-icon.js.map