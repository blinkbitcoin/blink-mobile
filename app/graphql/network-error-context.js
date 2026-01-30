import { createContext, useContext } from "react";
var NetworkErrorContext = createContext({
    networkError: undefined,
    token: undefined,
    clearNetworkError: function () { },
});
export var NetworkErrorContextProvider = NetworkErrorContext.Provider;
export var useNetworkError = function () { return useContext(NetworkErrorContext); };
//# sourceMappingURL=network-error-context.js.map