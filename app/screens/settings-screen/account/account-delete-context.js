import { createContext, useContext, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { Text, makeStyles, useTheme } from "@rn-vui/themed";
var AccountDeleteContext = createContext({
    setAccountIsBeingDeleted: function () { },
});
export var AccountDeleteContextProvider = function (_a) {
    var children = _a.children;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var LL = useI18nContext().LL;
    var _b = useState(false), accountIsBeingDeleted = _b[0], setAccountIsBeingDeleted = _b[1];
    var Loading = (<View style={styles.center}>
      <ActivityIndicator />
      <Text type="p2" color={colors.grey2}>
        {LL.AccountScreen.accountBeingDeleted()}
      </Text>
    </View>);
    return (<AccountDeleteContext.Provider value={{ setAccountIsBeingDeleted: setAccountIsBeingDeleted }}>
      {accountIsBeingDeleted ? Loading : children}
    </AccountDeleteContext.Provider>);
};
export var useAccountDeleteContext = function () { return useContext(AccountDeleteContext); };
var useStyles = makeStyles(function () { return ({
    center: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        rowGap: 10,
        justifyContent: "center",
        alignItems: "center",
    },
}); });
//# sourceMappingURL=account-delete-context.js.map