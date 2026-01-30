import { createContext, useContext } from "react";
var HideAmountContext = createContext({
    hideAmount: false,
    switchMemoryHideAmount: function () { },
});
export var HideAmountContextProvider = HideAmountContext.Provider;
export var useHideAmount = function () { return useContext(HideAmountContext); };
//# sourceMappingURL=hide-amount-context.js.map