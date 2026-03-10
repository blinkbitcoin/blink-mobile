const isRepeated = (pin: string): boolean => /^(\d)\1{3}$/.test(pin)

const isSequential = (pin: string): boolean => {
  const digits = pin.split("").map(Number)
  const diffs = digits.slice(1).map((d, i) => d - digits[i])
  return diffs.every((d) => d === 1) || diffs.every((d) => d === -1)
}

export const isWeakPin = (pin: string): boolean => isRepeated(pin) || isSequential(pin)
