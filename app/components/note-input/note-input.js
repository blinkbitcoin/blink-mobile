import React, { useRef } from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { useI18nContext } from "@app/i18n/i18n-react";
import { testProps } from "@app/utils/testProps";
import { makeStyles, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../atomic/galoy-icon";
export var NoteInput = function (_a) {
    var onChangeText = _a.onChangeText, value = _a.value, editable = _a.editable, onBlur = _a.onBlur, style = _a.style, _b = _a.big, big = _b === void 0 ? true : _b;
    var LL = useI18nContext().LL;
    var styles = useStyles({ editable: Boolean(editable), big: big });
    var colors = useTheme().theme.colors;
    var textInputRef = useRef(null);
    var focusTextInput = function () {
        if (textInputRef.current) {
            textInputRef.current.focus();
        }
    };
    return (<View style={[styles.fieldBackground, style]}>
      <View style={styles.noteContainer}>
        <TextInput {...testProps("add-note")} style={styles.noteInput} placeholder={LL.NoteInput.addNote()} placeholderTextColor={colors.black} onChangeText={onChangeText} onBlur={onBlur} value={value} editable={editable} selectTextOnFocus maxLength={500} ref={textInputRef}/>
        <TouchableOpacity style={styles.noteIconContainer} onPress={focusTextInput}>
          <GaloyIcon name={"note"} size={18} color={colors.primary}/>
        </TouchableOpacity>
      </View>
    </View>);
};
var useStyles = makeStyles(function (_a, _b) {
    var colors = _a.colors;
    var editable = _b.editable, big = _b.big;
    return ({
        fieldBackground: {
            flexDirection: "row",
            borderStyle: "solid",
            overflow: "hidden",
            backgroundColor: colors.grey5,
            paddingHorizontal: 10,
            borderRadius: 10,
            alignItems: "center",
            minHeight: big ? 60 : 50,
            opacity: editable ? 1 : 0.5,
        },
        fieldContainer: {
            marginBottom: 12,
        },
        noteContainer: {
            flex: 1,
            flexDirection: "row",
        },
        noteIconContainer: {
            justifyContent: "center",
            alignItems: "flex-start",
            paddingLeft: 20,
        },
        noteIcon: {
            justifyContent: "center",
            alignItems: "center",
        },
        noteInput: {
            flex: 1,
            color: colors.black,
            fontSize: 16,
        },
    });
});
//# sourceMappingURL=note-input.js.map