var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import { useEffect } from "react";
import { gql } from "@apollo/client";
import { useAnalyticsQuery } from "@app/graphql/generated";
import { useAppConfig } from "@app/hooks";
import analytics from "@react-native-firebase/analytics";
import { useIsAuthed } from "./is-authed-context";
import { useLevel } from "./level-context";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  query analytics {\n    me {\n      username\n      id\n    }\n    globals {\n      network\n    }\n  }\n"], ["\n  query analytics {\n    me {\n      username\n      id\n    }\n    globals {\n      network\n    }\n  }\n"])));
export var AnalyticsContainer = function () {
    var _a, _b, _c;
    var isAuthed = useIsAuthed();
    var level = useLevel();
    var galoyInstanceName = useAppConfig().appConfig.galoyInstance.name;
    var data = useAnalyticsQuery({
        skip: !isAuthed,
        fetchPolicy: "cache-first",
    }).data;
    useEffect(function () {
        var _a;
        analytics().setUserProperty("hasUsername", ((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username) ? "true" : "false");
    }, [(_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.username]);
    useEffect(function () {
        var _a, _b;
        if ((_a = data === null || data === void 0 ? void 0 : data.me) === null || _a === void 0 ? void 0 : _a.id) {
            analytics().setUserId((_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.id);
        }
    }, [(_b = data === null || data === void 0 ? void 0 : data.me) === null || _b === void 0 ? void 0 : _b.id]);
    useEffect(function () {
        var _a;
        if ((_a = data === null || data === void 0 ? void 0 : data.globals) === null || _a === void 0 ? void 0 : _a.network) {
            analytics().setUserProperties({ network: data.globals.network });
        }
    }, [(_c = data === null || data === void 0 ? void 0 : data.globals) === null || _c === void 0 ? void 0 : _c.network]);
    useEffect(function () {
        analytics().setUserProperty("accountLevel", level.currentLevel);
    }, [level]);
    useEffect(function () {
        analytics().setUserProperty("galoyInstance", galoyInstanceName);
    }, [galoyInstanceName]);
    return null;
};
var templateObject_1;
//# sourceMappingURL=analytics.js.map