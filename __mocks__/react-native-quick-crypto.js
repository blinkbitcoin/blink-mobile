/* eslint-disable no-undef */
const mockCipher = {
  update: jest.fn().mockReturnValue(Buffer.from("encrypted")),
  final: jest.fn().mockReturnValue(Buffer.from("")),
  getAuthTag: jest.fn().mockReturnValue(Buffer.from("0123456789abcdef")),
}

const mockDecipher = {
  update: jest.fn().mockReturnValue(Buffer.from("decrypted")),
  final: jest.fn().mockReturnValue(Buffer.from("")),
  setAuthTag: jest.fn(),
}

module.exports = {
  __esModule: true,
  default: {
    randomBytes: jest.fn((size) => Buffer.alloc(size, 0xab)),
    publicEncrypt: jest.fn().mockReturnValue(Buffer.from("rsa-encrypted-data")),
    createCipheriv: jest.fn().mockReturnValue(mockCipher),
    createDecipheriv: jest.fn().mockReturnValue(mockDecipher),
    pbkdf2Sync: jest.fn().mockReturnValue(Buffer.alloc(16, 0xcd)),
    constants: {
      RSA_PKCS1_OAEP_PADDING: 4,
    },
  },
  Buffer: {
    from: jest.fn((input) => Buffer.from(input)),
  },
}
