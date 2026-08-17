const assert = require("assert")
const snmp = require("net-snmp")
const { Target } = require("../dist/snmp")

const warnings = []

const log = {
  warning(message) {
    warnings.push(String(message))
  },
  debug() {},
  main() {},
  error() {},
}

async function testCounter64() {
  const target = new Target(
    {
      host: "192.0.2.10",
      version: "2c",
      community: "readonly",
      sensors: [
        {
          name: "Counter",
          oid: "1.3.6.1.2.1.31.1.1.1.6.1",
        },
      ],
    },
    log,
  )

  const expected = 0x0102030405060708n
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(expected)

  const decoded = target.decodeVarbind(
    {
      type: snmp.ObjectType.Counter64,
      value: buffer,
    },
    {
      name: "Counter",
      oid: "1.3.6.1.2.1.31.1.1.1.6.1",
    },
  )

  assert.strictEqual(decoded, expected)
}

async function testOverlappingPollSuppression() {
  warnings.length = 0

  const target = new Target(
    {
      host: "192.0.2.20",
      version: "2c",
      community: "readonly",
      scan_interval: 10,
      sensors: [
        {
          name: "Port status",
          oid: "1.3.6.1.2.1.2.2.1.8.1",
        },
      ],
    },
    log,
  )

  let getCalls = 0
  let release

  target.getOids = () => {
    getCalls += 1
    return new Promise((resolve) => {
      release = () =>
        resolve([
          {
            type: snmp.ObjectType.Integer,
            value: 1,
          },
        ])
    })
  }

  let responses = 0
  target.on("response", () => {
    responses += 1
  })

  const first = target.fetch()
  await Promise.resolve()

  const second = target.fetch()
  await second

  assert.strictEqual(getCalls, 1)
  assert.strictEqual(responses, 0)
  assert.ok(
    warnings.some((message) =>
      message.includes("Skipping overlapping poll"),
    ),
  )

  release()
  await first

  assert.strictEqual(responses, 1)

  target.getOids = async () => [
    {
      type: snmp.ObjectType.Integer,
      value: 2,
    },
  ]

  await target.fetch()
  assert.strictEqual(responses, 2)
}

async function main() {
  await testCounter64()
  await testOverlappingPollSuppression()
  console.log(
    "Switch Vision SNMP2MQTT Core v0.9.11 SNMP runtime regression: PASS",
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
