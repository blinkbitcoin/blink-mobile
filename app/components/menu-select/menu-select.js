import React from "react";
import { View } from "react-native";
import { Item } from "./item";
export var MenuSelect = function (_a) {
    var value = _a.value, onChange = _a.onChange, children = _a.children;
    var _b = React.useState(false), loading = _b[0], setLoading = _b[1];
    var childrenArray = React.Children.toArray(children);
    return (<View>
      {childrenArray.map(function (child) { return (<Item key={child.key} {...child.props} selected={child.props.value === value} onChange={onChange} loading={loading} setLoading={setLoading}/>); })}
    </View>);
};
//# sourceMappingURL=menu-select.js.map