import React from "react";
import { SetLightningAddressModal } from "../set-lightning-address-modal";
import { SetDefaultAccountModal } from "../set-default-account-modal";
import { TrialAccountLimitsModal } from "../upgrade-account-modal";
export var Action = {
    SetLnAddress: "SetLnAddress",
    SetDefaultAccount: "SetDefaultAccount",
    UpgradeAccount: "UpgradeAccount",
};
var ActionsContext = React.createContext({
    setActiveAction: function () { },
    activeAction: null,
});
export var ActionsProvider = function (_a) {
    var children = _a.children;
    var _b = React.useState(null), activeAction = _b[0], setActiveAction = _b[1];
    return (<ActionsContext.Provider value={{ activeAction: activeAction, setActiveAction: setActiveAction }}>
      {children}
    </ActionsContext.Provider>);
};
export var ActionModals = function () {
    var _a = useActionsContext(), activeAction = _a.activeAction, setActiveAction = _a.setActiveAction;
    var closeModal = function () { return setActiveAction(null); };
    return (<>
      <SetLightningAddressModal isVisible={activeAction === Action.SetLnAddress} toggleModal={closeModal}/>
      <SetDefaultAccountModal isVisible={activeAction === Action.SetDefaultAccount} toggleModal={closeModal}/>
      <TrialAccountLimitsModal isVisible={activeAction === Action.UpgradeAccount} closeModal={closeModal}/>
    </>);
};
export var useActionsContext = function () { return React.useContext(ActionsContext); };
//# sourceMappingURL=index.js.map