import { useEffect, useState } from "react";
export var useOutgoingBadgeVisibility = function (_a) {
    var txId = _a.txId, isOutgoing = _a.isOutgoing, amountText = _a.amountText, _b = _a.ttlMs, ttlMs = _b === void 0 ? 5000 : _b, onHide = _a.onHide;
    var _c = useState(false), visible = _c[0], setVisible = _c[1];
    useEffect(function () {
        if (!isOutgoing || !amountText) {
            setVisible(false);
            return;
        }
        var hideTimeout;
        var showTimeout = setTimeout(function () {
            setVisible(true);
            hideTimeout = setTimeout(function () {
                setVisible(false);
                onHide === null || onHide === void 0 ? void 0 : onHide();
            }, ttlMs);
        }, 50);
        return function () {
            clearTimeout(showTimeout);
            if (hideTimeout !== undefined) {
                clearTimeout(hideTimeout);
            }
        };
    }, [txId, isOutgoing, amountText, ttlMs, onHide]);
    return visible;
};
//# sourceMappingURL=use-outgoing-badge-visibility.js.map