import { Config } from "./types"
import { normalizeSnmpVersion } from "./snmp_version"

const INTERFACE_ATTRIBUTES = new Set([
  "oper_status",
  "admin_status",
  "speed_mbps",
  "rx_bytes",
  "tx_bytes",
  "alias",
])

const JUNIPER_VLAN_ATTRIBUTES = new Set([
  "mode",
  "native_vlan",
  "vlans",
  "tagged_vlans",
  "untagged_vlans",
  "summary",
])

const sensorInterfaceCandidates = (
  sensor: Config["targets"][number]["sensors"][number],
) => {
  const raw =
    sensor.interfaces && sensor.interfaces.length
      ? sensor.interfaces
      : sensor.interface
        ? [sensor.interface]
        : []
  return raw.map((value) => String(value || "").trim()).filter(Boolean)
}

export function validateConfigSemantics(config: Config): string[] {
  const errors: string[] = []

  for (
    let targetIndex = 0;
    targetIndex < config.targets.length;
    targetIndex++
  ) {
    const target = config.targets[targetIndex]
    const path = `targets[${targetIndex}] (${target.host})`
    let version: "1" | "2c" | "3"

    try {
      version = normalizeSnmpVersion(target.version)
    } catch (error) {
      errors.push(
        `${path}: ${error instanceof Error ? error.message : String(error)}`,
      )
      continue
    }

    if (version === "3" && !target.username?.trim()) {
      errors.push(`${path}: SNMPv3 requires username`)
    }

    if (target.auth_protocol && !target.auth_key) {
      errors.push(`${path}: auth_protocol requires auth_key`)
    }

    if (target.priv_key && !target.auth_key) {
      errors.push(`${path}: priv_key requires auth_key`)
    }

    if (target.priv_protocol && !target.priv_key) {
      errors.push(`${path}: priv_protocol requires priv_key`)
    }

    for (
      let sensorIndex = 0;
      sensorIndex < target.sensors.length;
      sensorIndex++
    ) {
      const sensor = target.sensors[sensorIndex]
      const sensorPath = `${path}.sensors[${sensorIndex}] (${sensor.name})`
      const source = sensor.source ?? "snmp"

      if (source === "snmp") {
        if (!sensor.oid?.trim()) {
          errors.push(`${sensorPath}: direct SNMP sensor requires oid`)
        }
        continue
      }

      const candidates = sensorInterfaceCandidates(sensor)
      if (!candidates.length) {
        errors.push(
          `${sensorPath}: ${source} sensor requires interface or interfaces`,
        )
      }
      if (candidates.length > 8) {
        errors.push(`${sensorPath}: at most 8 interface candidates are allowed`)
      }
      if (new Set(candidates).size !== candidates.length) {
        errors.push(`${sensorPath}: interface candidates must be unique`)
      }

      if (sensor.oid) {
        errors.push(`${sensorPath}: ${source} sensor must not define oid`)
      }

      if (source === "interface") {
        if (!sensor.attribute || !INTERFACE_ATTRIBUTES.has(sensor.attribute)) {
          errors.push(
            `${sensorPath}: unsupported interface attribute '${sensor.attribute ?? ""}'`,
          )
        }
      } else if (source === "juniper_ex_vlan") {
        if (
          !sensor.attribute ||
          !JUNIPER_VLAN_ATTRIBUTES.has(sensor.attribute)
        ) {
          errors.push(
            `${sensorPath}: unsupported Juniper VLAN attribute '${sensor.attribute ?? ""}'`,
          )
        }
      }
    }
  }

  if (config.homeassistant.discovery) {
    const identities = new Map<string, string>()

    for (
      let targetIndex = 0;
      targetIndex < config.targets.length;
      targetIndex++
    ) {
      const target = config.targets[targetIndex]

      for (
        let sensorIndex = 0;
        sensorIndex < target.sensors.length;
        sensorIndex++
      ) {
        const sensor = target.sensors[sensorIndex]
        if (!sensor.object_id) continue

        const objectId = sensor.object_id.trim()
        const path = `targets[${targetIndex}].sensors[${sensorIndex}] (${target.host} / ${sensor.name})`

        if (!objectId) {
          errors.push(`${path}: object_id cannot be empty`)
          continue
        }

        const key = objectId.toLowerCase()
        const previous = identities.get(key)
        if (previous) {
          errors.push(
            `${path}: object_id '${objectId}' collides with ${previous}`,
          )
        } else {
          identities.set(key, path)
        }
      }
    }
  }

  return errors
}
