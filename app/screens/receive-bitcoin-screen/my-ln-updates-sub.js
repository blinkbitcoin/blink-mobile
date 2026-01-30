var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
import React, { useState } from "react";
import { gql, useApolloClient } from "@apollo/client";
import { HomeAuthedDocument, useMyLnUpdatesSubscription } from "@app/graphql/generated";
import { LnUpdateHashPaidProvider } from "@app/graphql/ln-update-context";
gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  subscription myLnUpdates {\n    myUpdates {\n      errors {\n        message\n      }\n      update {\n        ... on LnUpdate {\n          paymentHash\n          status\n        }\n      }\n    }\n  }\n"], ["\n  subscription myLnUpdates {\n    myUpdates {\n      errors {\n        message\n      }\n      update {\n        ... on LnUpdate {\n          paymentHash\n          status\n        }\n      }\n    }\n  }\n"])));
export var MyLnUpdateSub = function (_a) {
    var children = _a.children;
    var client = useApolloClient();
    var dataSub = useMyLnUpdatesSubscription().data;
    var _b = useState(""), lastHash = _b[0], setLastHash = _b[1];
    React.useEffect(function () {
        var _a, _b;
        if (((_b = (_a = dataSub === null || dataSub === void 0 ? void 0 : dataSub.myUpdates) === null || _a === void 0 ? void 0 : _a.update) === null || _b === void 0 ? void 0 : _b.__typename) === "LnUpdate") {
            var update = dataSub.myUpdates.update;
            if (update.status === "PAID") {
                client.refetchQueries({ include: [HomeAuthedDocument] });
                setLastHash(update.paymentHash);
            }
        }
    }, [dataSub, client]);
    return <LnUpdateHashPaidProvider value={lastHash}>{children}</LnUpdateHashPaidProvider>;
};
export var withMyLnUpdateSub = function (Component) {
    return function WithMyLnUpdateSub(props) {
        return (<MyLnUpdateSub>
        <Component {...props}/>
      </MyLnUpdateSub>);
    };
};
var templateObject_1;
//# sourceMappingURL=my-ln-updates-sub.js.map