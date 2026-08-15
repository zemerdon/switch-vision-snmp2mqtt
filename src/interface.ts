import { InterfaceAttribute, SensorConfig } from "./types"
import { SnmpTable } from "./snmp_table"

export const IF_NAME_OID = "1.3.6.1.2.1.31.1.1.1.1"

export const INTERFACE_ATTRIBUTE_OIDS: Record<InterfaceAttribute, string> = {
  oper_status: "1.3.6.1.2.1.2.2.1.8",
  admin_status: "1.3.6.1.2.1.2.2.1.7",
  speed_mbps: "1.3.6.1.2.1.31.1.1.1.15",
  rx_bytes: "1.3.6.1.2.1.31.1.1.1.6",
  tx_bytes: "1.3.6.1.2.1.31.1.1.1.10",
  alias: "1.3.6.1.2.1.31.1.1.1.18",
}

export const interfaceCandidates = (sensor: SensorConfig): string[] => {
  const raw =
    sensor.interfaces && sensor.interfaces.length
      ? sensor.interfaces
      : sensor.interface
        ? [sensor.interface]
        : []

  const seen = new Set<string>()
  const result: string[] = []

  for (const value of raw) {
    const name = String(value || "").trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }

  return result
}

export const resolveInterfaceIndex = (
  ifNames: SnmpTable,
  candidates: string[],
): { name: string; ifIndex: number } | undefined => {
  const byName = new Map<string, number>()

  for (const [ifIndexRaw, nameRaw] of ifNames) {
    const ifIndex = Number(ifIndexRaw)
    const name = String(nameRaw ?? "").trim()
    if (!Number.isInteger(ifIndex) || ifIndex <= 0 || !name) continue
    if (!byName.has(name)) byName.set(name, ifIndex)
  }

  for (const candidate of candidates) {
    const name = String(candidate || "").trim()
    const ifIndex = byName.get(name)
    if (ifIndex !== undefined) return { name, ifIndex }
  }

  return undefined
}

export const interfaceOid = (
  attribute: InterfaceAttribute,
  ifIndex: number,
): string => `${INTERFACE_ATTRIBUTE_OIDS[attribute]}.${ifIndex}`
