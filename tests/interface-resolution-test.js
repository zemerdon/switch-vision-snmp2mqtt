const assert = require("assert")
const {
  interfaceCandidates,
  interfaceOid,
  resolveInterfaceIndex,
} = require("../dist/interface")

const sensor = {
  name: "SFP 1 RX",
  source: "interface",
  interfaces: ["xe-0/1/0", "ge-0/1/0"],
  attribute: "rx_bytes",
}

assert.deepStrictEqual(interfaceCandidates(sensor), [
  "xe-0/1/0",
  "ge-0/1/0",
])

let table = new Map([
  ["501", "ge-0/0/0"],
  ["601", "xe-0/1/0"],
  ["602", "xe-0/1/0.0"],
])

assert.deepStrictEqual(resolveInterfaceIndex(table, sensor.interfaces), {
  name: "xe-0/1/0",
  ifIndex: 601,
})
assert.strictEqual(
  interfaceOid("rx_bytes", 601),
  "1.3.6.1.2.1.31.1.1.1.6.601",
)

table = new Map([["701", "xe-0/1/0"]])
assert.deepStrictEqual(resolveInterfaceIndex(table, sensor.interfaces), {
  name: "xe-0/1/0",
  ifIndex: 701,
})

table = new Map([["811", "ge-0/1/0"]])
assert.deepStrictEqual(resolveInterfaceIndex(table, sensor.interfaces), {
  name: "ge-0/1/0",
  ifIndex: 811,
})

assert.strictEqual(
  resolveInterfaceIndex(new Map(), ["xe-0/1/1", "ge-0/1/1"]),
  undefined,
)

console.log("Switch Vision SNMP2MQTT live-interface resolution regression: PASS")
