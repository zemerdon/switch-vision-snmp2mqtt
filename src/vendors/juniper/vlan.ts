import * as snmp from "net-snmp"

export const JUNIPER_VLAN_OIDS = {
  ifName: "1.3.6.1.2.1.31.1.1.1.1",
  dot1dBasePortIfIndex: "1.3.6.1.2.1.17.1.4.1.2",
  dot1qPvid: "1.3.6.1.2.1.17.7.1.4.5.1.1",
  jnxExVlanName: "1.3.6.1.4.1.2636.3.40.1.5.1.5.1.2",
  jnxExVlanTag: "1.3.6.1.4.1.2636.3.40.1.5.1.5.1.5",
  jnxExVlanPortTagness: "1.3.6.1.4.1.2636.3.40.1.5.1.7.1.4",
  jnxExVlanPortAccessMode: "1.3.6.1.4.1.2636.3.40.1.5.1.7.1.5",
} as const

export type JuniperVlanAttribute =
  | "mode"
  | "native_vlan"
  | "vlans"
  | "tagged_vlans"
  | "untagged_vlans"
  | "summary"

export interface JuniperVlanPortState {
  interfaceName: string
  ifIndex: number
  bridgePort: number
  mode: "ACCESS" | "TRUNK" | "UNKNOWN"
  nativeVlan?: number
  vlans: number[]
  taggedVlans: number[]
  untaggedVlans: number[]
}

type Table = Map<string, string | number>

const parseIndex = (oid: string, baseOid: string): string => {
  const prefix = `${baseOid}.`
  return oid.startsWith(prefix) ? oid.slice(prefix.length) : ""
}

const valueToString = (value: unknown): string => {
  if (Buffer.isBuffer(value)) return value.toString()
  return String(value ?? "")
}

const valueToNumber = (value: unknown): number | undefined => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const walkTable = (session: any, oid: string): Promise<Table> =>
  new Promise((resolve, reject) => {
    const values: Table = new Map()

    session.subtree(
      oid,
      20,
      (varbinds: Array<{ oid: string; value: unknown }>) => {
        for (const varbind of varbinds) {
          if (snmp.isVarbindError(varbind)) continue
          const index = parseIndex(varbind.oid, oid)
          if (!index) continue
          values.set(
            index,
            Buffer.isBuffer(varbind.value)
              ? valueToString(varbind.value)
              : (varbind.value as string | number),
          )
        }
      },
      (error: Error | null) => {
        if (error) reject(error)
        else resolve(values)
      },
    )
  })

const normaliseInterfaceName = (name: string): string =>
  String(name || "").trim().replace(/\.0$/, "")

export const collectJuniperVlanPortStates = async (
  session: any,
): Promise<Map<string, JuniperVlanPortState>> => {
  const [
    ifNames,
    bridgeToIfIndex,
    pvids,
    vlanNames,
    vlanTags,
    tagness,
    accessModes,
  ] = await Promise.all([
    walkTable(session, JUNIPER_VLAN_OIDS.ifName),
    walkTable(session, JUNIPER_VLAN_OIDS.dot1dBasePortIfIndex),
    walkTable(session, JUNIPER_VLAN_OIDS.dot1qPvid),
    walkTable(session, JUNIPER_VLAN_OIDS.jnxExVlanName),
    walkTable(session, JUNIPER_VLAN_OIDS.jnxExVlanTag),
    walkTable(session, JUNIPER_VLAN_OIDS.jnxExVlanPortTagness),
    walkTable(session, JUNIPER_VLAN_OIDS.jnxExVlanPortAccessMode),
  ])

  // Keep the name table in the collection path for diagnostics and future
  // named-VLAN output. Current attributes publish numeric VLAN IDs.
  void vlanNames

  const ifIndexToName = new Map<number, string>()
  for (const [ifIndexRaw, nameRaw] of ifNames) {
    const ifIndex = valueToNumber(ifIndexRaw)
    if (ifIndex === undefined) continue
    ifIndexToName.set(ifIndex, valueToString(nameRaw))
  }

  const vlanIndexToTag = new Map<number, number>()
  for (const [vlanIndexRaw, tagRaw] of vlanTags) {
    const vlanIndex = valueToNumber(vlanIndexRaw)
    const tag = valueToNumber(tagRaw)
    if (vlanIndex === undefined || tag === undefined) continue
    vlanIndexToTag.set(vlanIndex, tag)
  }

  const bridgePortToIfIndex = new Map<number, number>()
  for (const [bridgePortRaw, ifIndexRaw] of bridgeToIfIndex) {
    const bridgePort = valueToNumber(bridgePortRaw)
    const ifIndex = valueToNumber(ifIndexRaw)
    if (bridgePort === undefined || ifIndex === undefined) continue
    bridgePortToIfIndex.set(bridgePort, ifIndex)
  }

  const statesByBridgePort = new Map<number, JuniperVlanPortState>()
  const ensureState = (bridgePort: number): JuniperVlanPortState | undefined => {
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
    if (bridgePort === undefined || pvid === undefined) continue
    const state = ensureState(bridgePort)
    if (state) state.nativeVlan = pvid
  }

  const processVlanPortTable = (
    table: Table,
    handler: (
      state: JuniperVlanPortState,
      vlanTag: number,
      value: number,
    ) => void,
  ) => {
    for (const [index, rawValue] of table) {
      const [vlanIndexRaw, bridgePortRaw] = index.split(".")
      const vlanIndex = valueToNumber(vlanIndexRaw)
      const bridgePort = valueToNumber(bridgePortRaw)
      const value = valueToNumber(rawValue)
      if (
        vlanIndex === undefined ||
        bridgePort === undefined ||
        value === undefined
      )
        continue
      const vlanTag = vlanIndexToTag.get(vlanIndex)
      if (vlanTag === undefined || vlanTag === 0) continue
      const state = ensureState(bridgePort)
      if (!state) continue
      handler(state, vlanTag, value)
    }
  }

  processVlanPortTable(accessModes, (state, vlanTag, value) => {
    if (!state.vlans.includes(vlanTag)) state.vlans.push(vlanTag)
    if (value === 2) state.mode = "TRUNK"
    else if (value === 1 && state.mode !== "TRUNK") state.mode = "ACCESS"
  })

  processVlanPortTable(tagness, (state, vlanTag, value) => {
    if (!state.vlans.includes(vlanTag)) state.vlans.push(vlanTag)
    if (value === 1 && !state.taggedVlans.includes(vlanTag))
      state.taggedVlans.push(vlanTag)
    if (value === 2 && !state.untaggedVlans.includes(vlanTag))
      state.untaggedVlans.push(vlanTag)
  })

  const states = new Map<string, JuniperVlanPortState>()
  for (const state of statesByBridgePort.values()) {
    state.vlans.sort((a, b) => a - b)
    state.taggedVlans.sort((a, b) => a - b)
    state.untaggedVlans.sort((a, b) => a - b)

    states.set(state.interfaceName, state)
    states.set(normaliseInterfaceName(state.interfaceName), state)
  }

  return states
}

export const juniperVlanAttributeValue = (
  state: JuniperVlanPortState,
  attribute: JuniperVlanAttribute,
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
