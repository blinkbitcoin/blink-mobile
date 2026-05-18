import Crypto from "react-native-quick-crypto"

export const generateNwcSecret = (): string => Crypto.randomBytes(32).toString("hex")
