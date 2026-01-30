import React from "react";
import { TouchableWithoutFeedback, View } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { testProps } from "@app/utils/testProps";
import { Text, makeStyles } from "@rn-vui/themed";
var ButtonForButtonGroup = function (_a) {
    var text = _a.text, icon = _a.icon, selected = _a.selected, onPress = _a.onPress, disabled = _a.disabled;
    var styles = useStyles({ selected: Boolean(selected), disabled: Boolean(disabled) });
    return (<TouchableWithoutFeedback onPress={onPress}>
      <View style={styles.button}>
        <Text {...testProps(text)} style={styles.text} ellipsizeMode="tail" numberOfLines={1}>
          {text}
        </Text>
        {typeof icon === "string" ? (<Icon style={styles.text} name={icon}/>) : selected ? (icon.selected) : (icon.normal)}
      </View>
    </TouchableWithoutFeedback>);
};
export var ButtonGroup = function (_a) {
    var buttons = _a.buttons, selectedId = _a.selectedId, onPress = _a.onPress, style = _a.style, disabled = _a.disabled;
    var styles = useStyles();
    var selectedButton = buttons.find(function (_a) {
        var id = _a.id;
        return id === selectedId;
    });
    return (<View style={[styles.buttonGroup, style]}>
      {!disabled &&
            buttons.map(function (props) { return (<ButtonForButtonGroup key={props.id} {...props} onPress={function () {
                    if (selectedId !== props.id) {
                        onPress(props.id);
                    }
                }} selected={selectedId === props.id}/>); })}
      {disabled && selectedButton && (<ButtonForButtonGroup {...selectedButton} selected={true} onPress={function () { }}/>)}
    </View>);
};
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var selected = _b.selected, disabled = _b.disabled;
    return ({
        button: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 10,
            paddingVertical: 14,
            borderRadius: 8,
            opacity: disabled ? 0.4 : 1,
            backgroundColor: colors.grey5,
            height: "100%",
        },
        text: {
            fontSize: 16,
            color: selected ? colors.primary : colors.grey1,
        },
        buttonGroup: {
            flexDirection: "row",
            columnGap: 10,
            justifyContent: "space-between",
            alignItems: "center",
        },
    });
});
//# sourceMappingURL=button-group.js.map