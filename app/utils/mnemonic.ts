export const normalizeMnemonic = (mnemonic: string): string =>
  mnemonic.trim().replace(/\s+/g, " ")
