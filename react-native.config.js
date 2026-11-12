// eslint-disable-next-line @typescript-eslint/no-var-requires
const meawalletMpp = require("./scripts/meawallet-mpp")

module.exports = {
  assets: ["./app/assets/fonts/"],
  dependencies: meawalletMpp.isInstalled()
    ? { "@meawallet/react-native-mpp": { root: meawalletMpp.root } }
    : {},
}
