const { normalizeSnmpVersion } = require("../dist/snmp_version")

const valid = [
  [undefined, "1"],
  [1, "1"],
  ["1", "1"],
  ["2c", "2c"],
  [3, "3"],
  ["3", "3"],
]

for (const [input, expected] of valid) {
  if (normalizeSnmpVersion(input) !== expected) {
    throw new Error(`SNMP version ${String(input)} did not normalize to ${expected}`)
  }
}

for (const input of [2, "2", "v2c", 4, null]) {
  let rejected = false
  try {
    normalizeSnmpVersion(input)
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error(`Invalid SNMP version accepted: ${String(input)}`)
}

console.log("Switch Vision SNMP2MQTT SNMP-version regression: PASS")
