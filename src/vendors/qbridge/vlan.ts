import * as snmp from "net-snmp"

import { SnmpTable, walkTable } from "../../snmp_table"

export const QBRIDGE_VLAN_OIDS = {
  ifName: "1.3.6.1.2.1.31.1.1.1.1",
  dot1dBasePortIfIndex: "1.3.6.1.2.1.17.1.4.1.2",
  dot1qPvid: "1.3.6.1.2.1.17.7.1.4.5.1.1",
  dot1qVlanCurrentEgressPorts: "1.3.6.1.2.1.17.7.1.4.2.1.4",
  dot1qVlanStaticEgressPorts: "1.3.6.1.2.1.17.7.1.4.3.1.2",
  dot1qVlanStaticUntaggedPorts: "1.3.6.1.2.1.17.7.1.4.3.1.4",
} as const

export type QBridgeVlanAttribute =
  | "mode"
  | "native_vlan"
  | "vlans"
  | "tagged_vlans"
  | "untagged_vlans"
  | "summary"

export interface QBridgeVlanPortState {
  interfaceName: string
  ifIndex: number
  bridgePort: number
  mode: "ACCESS" | "TRUNK" | "UNKNOWN"
  nativeVlan?: number
  vlans: number[]
  taggedVlans: number[]
  untaggedVlans: number[]
}

type OctetTable = Map<string, Buffer>

const walkOctetTable = (session: any, oid: string): Promise<OctetTable> =>
  new Promise((resolve, reject) => {
    const values: OctetTable = new Map()

    session.subtree(
      oid,
      20,
      (varbinds: Array<{ oid: string; value: unknown }>) => {
        const prefix = `${oid}.`
        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) continue
          if (!varbind.oid.startsWith(prefix)) continue
          const index = varbind.oid.slice(prefix.length)
          if (!index) continue
          if (Buffer.isBuffer(varbind.value)) {
            values.set(index, Buffer.from(varbind.value))
          }
        }
      },
      (error: Error | null) => {
        if (error) reject(error)
        else resolve(values)
      },
    )
  })

const valueToString = (value: unknown): string => {
  if (Buffer.isBuffer(value)) return value.toString()
  return String(value ?? "")
}

const valueToNumber = (value: unknown): number | undefined => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const bitmapHasBridgePort = (bitmap: Buffer, bridgePort: number): boolean => {
  if (!Number.isInteger(bridgePort) || bridgePort <= 0) return false
  const zeroBased = bridgePort - 1
  const byteIndex = Math.floor(zeroBased / 8)
  const bitIndex = zeroBased % 8
  if (byteIndex < 0 || byteIndex >= bitmap.length) return false
  return (bitmap[byteIndex] & (0x80 >> bitIndex)) !== 0
}

const currentEgressByVlan = (table: OctetTable): Map<number, Buffer> => {
  const selected = new Map<number, { timeMark: number; bitmap: Buffer }>()

  for (const [index, bitmap] of table) {
    const parts = index.split(".")
    if (parts.length < 2) continue
    const vlan = valueToNumber(parts[parts.length - 1])
    const timeMark = valueToNumber(parts[parts.length - 2])
    if (vlan === undefined || vlan < 1 || vlan > 4094 || timeMark === undefined)
      continue

    const prior = selected.get(vlan)
    if (!prior || timeMark >= prior.timeMark) {
      selected.set(vlan, { timeMark, bitmap })
    }
  }

  return new Map(
    [...selected.entries()].map(([vlan, value]) => [vlan, value.bitmap]),
  )
}

const staticBitmapByVlan = (table: OctetTable): Map<number, Buffer> => {
  const result = new Map<number, Buffer>()
  for (const [index, bitmap] of table) {
    const parts = index.split(".")
    const vlan = valueToNumber(parts[parts.length - 1])
    if (vlan === undefined || vlan < 1 || vlan > 4094) continue
    result.set(vlan, bitmap)
  }
  return result
}

export const collectQBridgeVlanPortStates = async (
  session: any,
  ifNamesOverride?: SnmpTable,
): Promise<Map<string, QBridgeVlanPortState>> => {
  const [
    ifNames,
    bridgeToIfIndex,
    pvids,
    currentEgressRaw,
    staticEgressRaw,
    staticUntaggedRaw,
  ] = await Promise.all([
    ifNamesOverride ?? walkTable(session, QBRIDGE_VLAN_OIDS.ifName),
    walkTable(session, QBRIDGE_VLAN_OIDS.dot1dBasePortIfIndex),
    walkTable(session, QBRIDGE_VLAN_OIDS.dot1qPvid),
    walkOctetTable(session, QBRIDGE_VLAN_OIDS.dot1qVlanCurrentEgressPorts),
    walkOctetTable(session, QBRIDGE_VLAN_OIDS.dot1qVlanStaticEgressPorts),
    walkOctetTable(session, QBRIDGE_VLAN_OIDS.dot1qVlanStaticUntaggedPorts),
  ])

  const ifIndexToName = new Map<number, string>()
  for (const [ifIndexRaw, nameRaw] of ifNames) {
    const ifIndex = valueToNumber(ifIndexRaw)
    const name = valueToString(nameRaw).trim()
    if (ifIndex === undefined || !Number.isInteger(ifIndex) || ifIndex <= 0)
      continue
    if (!name) continue
    ifIndexToName.set(ifIndex, name)
  }

  const bridgePortToIfIndex = new Map<number, number>()
  for (const [bridgePortRaw, ifIndexRaw] of bridgeToIfIndex) {
    const bridgePort = valueToNumber(bridgePortRaw)
    const ifIndex = valueToNumber(ifIndexRaw)
    if (
      bridgePort === undefined ||
      ifIndex === undefined ||
      !Number.isInteger(bridgePort) ||
      !Number.isInteger(ifIndex) ||
      bridgePort <= 0 ||
      ifIndex <= 0
    )
      continue
    bridgePortToIfIndex.set(bridgePort, ifIndex)
  }

  const statesByBridgePort = new Map<number, QBridgeVlanPortState>()
  const ensureState = (
    bridgePort: number,
  ): QBridgeVlanPortState | undefined => {
    const ifIndex = bridgePortToIfIndex.get(bridgePort)
    if (ifIndex === undefined) return undefined
    const interfaceName = ifIndexToName.get(ifIndex)
    if (!interfaceName) return undefined

    let state = statesByBridgePort.get(bridgePort)
    if (!state) {
      state = {
        interfaceName,
        ifIndex,
        bridgePort,
        mode: "UNKNOWN",
        vlans: [],
        taggedVlans: [],
        untaggedVlans: [],
      }
      statesByBridgePort.set(bridgePort, state)
    }
    return state
  }

  for (const [bridgePortRaw, pvidRaw] of pvids) {
    const bridgePort = valueToNumber(bridgePortRaw)
    const pvid = valueToNumber(pvidRaw)
    if (
      bridgePort === undefined ||
      pvid === undefined ||
      pvid < 1 ||
      pvid > 4094
    )
      continue
    const state = ensureState(bridgePort)
    if (state) state.nativeVlan = pvid
  }

  const currentEgress = currentEgressByVlan(currentEgressRaw)
  const staticEgress = staticBitmapByVlan(staticEgressRaw)
  const staticUntagged = staticBitmapByVlan(staticUntaggedRaw)
  const vlanIds = new Set<number>([
    ...currentEgress.keys(),
    ...staticEgress.keys(),
  ])

  for (const vlan of vlanIds) {
    const egress = currentEgress.get(vlan) ?? staticEgress.get(vlan)
    if (!egress) continue
    const untagged = staticUntagged.get(vlan)

    for (const bridgePort of bridgePortToIfIndex.keys()) {
      if (!bitmapHasBridgePort(egress, bridgePort)) continue
      const state = ensureState(bridgePort)
      if (!state) continue
      if (!state.vlans.includes(vlan)) state.vlans.push(vlan)

      if (untagged) {
        if (bitmapHasBridgePort(untagged, bridgePort)) {
          if (!state.untaggedVlans.includes(vlan))
            state.untaggedVlans.push(vlan)
        } else if (!state.taggedVlans.includes(vlan)) {
          state.taggedVlans.push(vlan)
        }
      }
    }
  }

  const states = new Map<string, QBridgeVlanPortState>()
  for (const state of statesByBridgePort.values()) {
    if (
      state.nativeVlan !== undefined &&
      !state.vlans.includes(state.nativeVlan)
    ) {
      state.vlans.push(state.nativeVlan)
    }

    state.vlans.sort((a, b) => a - b)
    state.taggedVlans.sort((a, b) => a - b)
    state.untaggedVlans.sort((a, b) => a - b)

    if (state.vlans.length > 1 || state.taggedVlans.length > 0) {
      state.mode = "TRUNK"
    } else if (state.vlans.length === 1 || state.nativeVlan !== undefined) {
      state.mode = "ACCESS"
    }

    states.set(state.interfaceName, state)
  }

  return states
}

export const qbridgeVlanAttributeValue = (
  state: QBridgeVlanPortState,
  attribute: QBridgeVlanAttribute,
): string | number => {
  switch (attribute) {
    case "mode":
      return state.mode
    case "native_vlan":
      return state.nativeVlan ?? "unknown"
    case "vlans":
      return state.vlans.join(",")
    case "tagged_vlans":
      return state.taggedVlans.join(",")
    case "untagged_vlans":
      return state.untaggedVlans.join(",")
    case "summary":
      return state.mode === "TRUNK"
        ? `TRUNK (native ${state.nativeVlan ?? "unknown"}; VLANs ${state.vlans.join(",")})`
        : `VLAN ${state.nativeVlan ?? state.vlans[0] ?? "unknown"}`
  }
}
