import { createContext, useContext } from "react";
var IsAuthed = createContext(false);
export var IsAuthedContextProvider = IsAuthed.Provider;
export var useIsAuthed = function () { return useContext(IsAuthed); };
//# sourceMappingURL=is-authed-context.js.map