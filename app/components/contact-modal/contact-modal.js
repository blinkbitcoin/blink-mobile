import React from "react";
import { Linking } from "react-native";
import ReactNativeModal from "react-native-modal";
import { CONTACT_EMAIL_ADDRESS, WHATSAPP_CONTACT_NUMBER } from "@app/config";
import { useI18nContext } from "@app/i18n/i18n-react";
import { openWhatsApp } from "@app/utils/external";
import { Icon, ListItem, makeStyles, useTheme, Text } from "@rn-vui/themed";
import TelegramOutline from "./telegram.svg";
export var SupportChannels = {
    Email: "email",
    Telegram: "telegram",
    WhatsApp: "whatsapp",
    StatusPage: "statusPage",
    Mattermost: "mattermost",
    Faq: "faq",
};
/*
A modal component that displays contact options at the bottom of the screen.
*/
var ContactModal = function (_a) {
    var isVisible = _a.isVisible, toggleModal = _a.toggleModal, messageBody = _a.messageBody, messageSubject = _a.messageSubject, supportChannels = _a.supportChannels;
    var LL = useI18nContext().LL;
    var styles = useStyles();
    var colors = useTheme().theme.colors;
    var contactOptionList = [
        {
            id: SupportChannels.StatusPage,
            name: LL.support.statusPage(),
            icon: <Icon name={"alert-circle-outline"} type="ionicon" size={20}/>,
            action: function () {
                // TODO: extract in Instance
                Linking.openURL("https://blink.statuspage.io/");
            },
        },
        {
            id: SupportChannels.Faq,
            name: LL.support.faq(),
            icon: <Icon name={"book-outline"} type="ionicon" color={colors.black} size={20}/>,
            action: function () {
                Linking.openURL("https://faq.blink.sv");
                toggleModal();
            },
        },
        {
            id: SupportChannels.Telegram,
            name: LL.support.telegram(),
            icon: <TelegramOutline width={20} height={20} fill={colors.black}/>,
            action: function () {
                Linking.openURL("https://t.me/blinkbtc");
                toggleModal();
            },
        },
        {
            id: SupportChannels.Mattermost,
            name: LL.support.mattermost(),
            icon: (<Icon name={"chatbubbles-outline"} type="ionicon" color={colors.black} size={20}/>),
            action: function () {
                Linking.openURL("https://chat.blink.sv");
                toggleModal();
            },
        },
        {
            id: SupportChannels.WhatsApp,
            name: LL.support.whatsapp(),
            icon: <Icon name={"logo-whatsapp"} type="ionicon" color={colors.black} size={20}/>,
            action: function () {
                openWhatsAppAction(messageBody);
                toggleModal();
            },
        },
        {
            id: SupportChannels.Email,
            name: LL.support.email(),
            icon: <Icon name={"mail-outline"} type="ionicon" color={colors.black} size={20}/>,
            action: function () {
                Linking.openURL("mailto:".concat(CONTACT_EMAIL_ADDRESS, "?subject=").concat(encodeURIComponent(messageSubject), "&body=").concat(encodeURIComponent(messageBody)));
                toggleModal();
            },
        },
    ];
    return (<ReactNativeModal isVisible={isVisible} backdropOpacity={0.8} backdropColor={colors.white} onBackdropPress={toggleModal} style={styles.modal}>
      {contactOptionList
            .filter(function (item) { return supportChannels.includes(item.id); })
            .map(function (item) {
            return (<ListItem key={item.name} bottomDivider onPress={item.action} containerStyle={styles.listItemContainer}>
              {item.icon}
              <ListItem.Content>
                <ListItem.Title style={styles.listItemTitle}>
                  <Text type="p2">{item.name}</Text>
                </ListItem.Title>
              </ListItem.Content>
              <ListItem.Chevron name={"chevron-forward"} type="ionicon" color={colors.primary} size={20}/>
            </ListItem>);
        })}
    </ReactNativeModal>);
};
export default ContactModal;
export var openWhatsAppAction = function (message) {
    openWhatsApp(WHATSAPP_CONTACT_NUMBER, message);
};
var useStyles = makeStyles(function (_a) {
    var colors = _a.colors;
    return ({
        modal: {
            justifyContent: "flex-end",
            flexGrow: 1,
            marginHorizontal: 0,
        },
        listItemContainer: {
            backgroundColor: colors.grey5,
        },
        listItemTitle: {
            color: colors.black,
        },
        icons: {
            color: colors.black,
        },
    });
});
//# sourceMappingURL=contact-modal.js.map