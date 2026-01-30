import React from "react";
import { Platform, View, TouchableOpacity, } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import Modal from "react-native-modal";
import { makeStyles, Text, useTheme } from "@rn-vui/themed";
import { GaloyIcon } from "../atomic/galoy-icon";
import { GaloyPrimaryButton } from "../atomic/galoy-primary-button";
import { GaloySecondaryButton } from "../atomic/galoy-secondary-button";
var CustomModal = function (_a) {
    var isVisible = _a.isVisible, toggleModal = _a.toggleModal, image = _a.image, headerTitle = _a.headerTitle, headerTitleSize = _a.headerTitleSize, title = _a.title, body = _a.body, minHeight = _a.minHeight, titleMaxWidth = _a.titleMaxWidth, titleTextAlignment = _a.titleTextAlignment, primaryButtonTitle = _a.primaryButtonTitle, nonScrollingContent = _a.nonScrollingContent, primaryButtonOnPress = _a.primaryButtonOnPress, primaryButtonTextAbove = _a.primaryButtonTextAbove, primaryButtonLoading = _a.primaryButtonLoading, primaryButtonDisabled = _a.primaryButtonDisabled, secondaryButtonTitle = _a.secondaryButtonTitle, secondaryButtonOnPress = _a.secondaryButtonOnPress, secondaryButtonLoading = _a.secondaryButtonLoading, _b = _a.showCloseIconButton, showCloseIconButton = _b === void 0 ? true : _b, backgroundModalColor = _a.backgroundModalColor, titleFontSize = _a.titleFontSize;
    var styles = useStyles({
        hasPrimaryButtonTextAbove: Boolean(primaryButtonTextAbove),
        minHeight: minHeight,
        titleMaxWidth: titleMaxWidth,
        titleTextAlignment: titleTextAlignment,
        showCloseIconButton: showCloseIconButton,
        backgroundModalColor: backgroundModalColor,
        titleFontSize: titleFontSize,
        /* eslint @typescript-eslint/ban-ts-comment: "off" */
        // @ts-ignore-next-line no-implicit-any error
    });
    var _c = useTheme().theme, mode = _c.mode, colors = _c.colors;
    return (<Modal isVisible={isVisible} backdropOpacity={0.8} backdropColor={colors.white} backdropTransitionOutTiming={0} avoidKeyboard={true} onBackdropPress={toggleModal}>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          {headerTitle ? (<Text numberOfLines={1} ellipsizeMode="tail" style={styles.headerTitle} type={headerTitleSize || "h1"}>
              {headerTitle}
            </Text>) : (<View></View>)}

          {showCloseIconButton && (<TouchableOpacity onPress={toggleModal}>
              <GaloyIcon name="close" size={30} color={colors.grey0}/>
            </TouchableOpacity>)}
        </View>
        <ScrollView style={styles.modalCard} persistentScrollbar={true} indicatorStyle={mode === "dark" ? "white" : "black"} bounces={false} contentContainerStyle={styles.scrollViewContainer}>
          {image && <View style={styles.imageContainer}>{image}</View>}
          {title && (<View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitleText}>{title}</Text>
            </View>)}
          <View style={styles.modalBodyContainer}>{body}</View>
        </ScrollView>
        {nonScrollingContent}
        <View style={styles.modalActionsContainer}>
          <View>
            {primaryButtonTextAbove && (<Text style={styles.primaryButtonTextAbove} type="p3">
                {primaryButtonTextAbove}
              </Text>)}
            <GaloyPrimaryButton title={primaryButtonTitle} onPress={primaryButtonOnPress} loading={primaryButtonLoading} disabled={primaryButtonDisabled}/>
          </View>
          {secondaryButtonTitle && secondaryButtonOnPress && (<GaloySecondaryButton title={secondaryButtonTitle} loading={secondaryButtonLoading} onPress={secondaryButtonOnPress}/>)}
        </View>
      </View>
    </Modal>);
};
export default CustomModal;
var useStyles = makeStyles(function (_a, props) {
    var _b, _c;
    var colors = _a.colors;
    return ({
        container: {
            backgroundColor: (_b = props.backgroundModalColor) !== null && _b !== void 0 ? _b : colors.grey5,
            maxHeight: "95%",
            minHeight: props.minHeight || "auto",
            borderRadius: 16,
            padding: 20,
        },
        modalCard: {
            width: "100%",
        },
        imageContainer: {
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: 20,
            paddingTop: props.showCloseIconButton ? 0 : 20,
        },
        modalTitleContainer: {
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: 10,
        },
        modalTitleText: {
            fontSize: (_c = props.titleFontSize) !== null && _c !== void 0 ? _c : 24,
            fontWeight: Platform.OS === "ios" ? "600" : "700",
            lineHeight: 32,
            maxWidth: props.titleMaxWidth || "80%",
            textAlign: props.titleTextAlignment || "center",
            color: colors.black,
        },
        modalBodyContainer: {
            flex: 1,
            flexGrow: 1,
        },
        scrollViewContainer: { flexGrow: 1 },
        modalBodyText: {
            fontSize: 20,
            fontWeight: "400",
            lineHeight: 24,
            textAlign: "center",
            maxWidth: "80%",
        },
        primaryButtonTextAbove: {
            textAlign: "center",
            paddingVertical: 8,
        },
        modalActionsContainer: {
            width: "100%",
            height: "auto",
            flexDirection: "column",
            rowGap: 12,
            marginTop: props.hasPrimaryButtonTextAbove ? 0 : 20,
        },
        headerContainer: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
        },
        headerTitle: {
            flexShrink: 1,
            flexGrow: 1,
            marginRight: 10,
        },
    });
});
//# sourceMappingURL=custom-modal.js.map