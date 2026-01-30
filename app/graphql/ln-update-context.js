import { createContext, useContext } from "react";
var LnUpdateHashPaid = createContext("");
export var LnUpdateHashPaidProvider = LnUpdateHashPaid.Provider;
export var useLnUpdateHashPaid = function () { return useContext(LnUpdateHashPaid); };
//# sourceMappingURL=ln-update-context.js.map