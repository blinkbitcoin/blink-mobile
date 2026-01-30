import * as React from "react";
import { useApolloClient } from "@apollo/client";
import { useUpgradeModalLastShownAtQuery, useDeviceSessionCountQuery, } from "@app/graphql/generated";
import { setUpgradeModalLastShownAt } from "@app/graphql/client-only-query";
import { useRemoteConfig } from "@app/config/feature-flags-context";
export var useAutoShowUpgradeModal = function (options) {
    var _a, _b;
    if (options === void 0) { options = {}; }
    var _c = options.cooldownDays, cooldownDays = _c === void 0 ? 7 : _c, _d = options.enabled, enabled = _d === void 0 ? true : _d;
    var client = useApolloClient();
    var upgradeModalShowAtSessionNumber = useRemoteConfig().upgradeModalShowAtSessionNumber;
    var data = useUpgradeModalLastShownAtQuery({
        fetchPolicy: "cache-first",
        skip: !enabled,
    }).data;
    var sessionData = useDeviceSessionCountQuery({
        skip: !enabled,
    }).data;
    var lastShownAt = (_a = data === null || data === void 0 ? void 0 : data.upgradeModalLastShownAt) !== null && _a !== void 0 ? _a : null;
    var sessions = (_b = sessionData === null || sessionData === void 0 ? void 0 : sessionData.deviceSessionCount) !== null && _b !== void 0 ? _b : 0;
    var canShowUpgradeModal = React.useMemo(function () {
        if (!enabled || sessions < upgradeModalShowAtSessionNumber)
            return false;
        if (!lastShownAt)
            return true;
        var last = new Date(lastShownAt).getTime();
        return Date.now() - last >= cooldownDays * 24 * 60 * 60 * 1000;
    }, [enabled, sessions, lastShownAt, cooldownDays, upgradeModalShowAtSessionNumber]);
    var markShownUpgradeModal = React.useCallback(function () {
        if (!enabled)
            return;
        setUpgradeModalLastShownAt(client, new Date().toISOString());
    }, [client, enabled]);
    var resetUpgradeModal = React.useCallback(function () {
        if (!enabled)
            return;
        setUpgradeModalLastShownAt(client, null);
    }, [client, enabled]);
    return {
        canShowUpgradeModal: canShowUpgradeModal,
        lastShownUpgradeModalAt: lastShownAt,
        markShownUpgradeModal: markShownUpgradeModal,
        resetUpgradeModal: resetUpgradeModal,
    };
};
//# sourceMappingURL=use-show-upgrade-modal.js.map