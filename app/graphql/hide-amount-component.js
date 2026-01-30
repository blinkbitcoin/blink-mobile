import * as React from "react";
import { useState } from "react";
import { useHideBalanceQuery } from "@app/graphql/generated";
import { HideAmountContextProvider } from "./hide-amount-context";
export var HideAmountContainer = function (_a) {
    var children = _a.children;
    var _b = useHideBalanceQuery().data, _c = _b === void 0 ? { hideBalance: false } : _b, hideBalance = _c.hideBalance;
    var _d = useState(hideBalance), hideAmount = _d[0], setHideAmount = _d[1];
    var switchMemoryHideAmount = function () {
        setHideAmount(!hideAmount);
    };
    return (<HideAmountContextProvider value={{ hideAmount: hideAmount, switchMemoryHideAmount: switchMemoryHideAmount }}>
      {children}
    </HideAmountContextProvider>);
};
//# sourceMappingURL=hide-amount-component.js.map