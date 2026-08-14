const { validateConfigSemantics } = require("../dist/config_semantics")

const base = () => ({
  log: "info",
  mqtt: {
    host: "mqtt.example.invalid",
    retain: true,
    qos: 0,
    clean: true,
  },
  homeassistant: {
    discovery: true,
    prefix: "homeassistant",
  },
  targets: [
    {
      host: "192.0.2.10",
      community: "readonly",
      version: "2c",
      sensors: [
        {
          name: "Port 1 Link",
          object_id: "sw1_port_1_link",
          oid: "1.3.6.1.2.1.2.2.1.8.1",
          binary_sensor: true,
        },
      ],
    },
  ],
})

const valid = base()
if (validateConfigSemantics(valid).length) {
  throw new Error(validateConfigSemantics(valid).join("\n"))
}

const duplicate = base()
duplicate.targets.push({
  host: "192.0.2.11",
  version: "2c",
  sensors: [{ name: "Other CPU", object_id: "SW1_PORT_1_LINK", oid: "1.3.6.1" }],
})
if (!validateConfigSemantics(duplicate).some((error) => error.includes("collides"))) {
  throw new Error("Duplicate explicit object_id was not rejected")
}

const legacyNames = base()
delete legacyNames.targets[0].sensors[0].object_id
legacyNames.targets.push({
  host: "192.0.2.11",
  version: "2c",
  sensors: [{ name: "Port 1 Link", oid: "1.3.6.1" }],
})
if (validateConfigSemantics(legacyNames).length) {
  throw new Error("Legacy sensors without object_id should remain compatible")
}

const snmpV3 = base()
snmpV3.targets[0].version = "3"
delete snmpV3.targets[0].community
if (!validateConfigSemantics(snmpV3).some((error) => error.includes("requires username"))) {
  throw new Error("SNMPv3 without username was not rejected")
}

const badPrivacy = base()
badPrivacy.targets[0].auth_protocol = "sha"
if (!validateConfigSemantics(badPrivacy).some((error) => error.includes("auth_protocol requires auth_key"))) {
  throw new Error("auth_protocol without auth_key was not rejected")
}

const badPriv = base()
badPriv.targets[0].priv_key = "secret"
if (!validateConfigSemantics(badPriv).some((error) => error.includes("priv_key requires auth_key"))) {
  throw new Error("priv_key without auth_key was not rejected")
}

console.log("Switch Vision SNMP2MQTT config-semantics regression: PASS")
