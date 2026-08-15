import { LogLevelStrings } from "./log"

export interface MQTTConfig {
  host: string
  port?: number
  username?: string
  password?: string
  retain: boolean
  qos: 0 | 1 | 2
  client_id?: string
  keepalive?: number
  base_topic?: string
  host_name_as_target?: boolean
  ca?: string
  cert?: string
  key?: string
  clean: boolean
  reject_unauthorized?: boolean
}

export interface TargetConfig {
  host: string
  mac?: string
  sensors: SensorConfig[]
  name?: string
  device_manufacturer?: string
  device_model?: string
  suggested_area?: string
  community?: string
  version?: VersionConfig
  port?: number
  scan_interval?: number
  username?: string
  auth_protocol?: "md5" | "sha"
  auth_key?: string
  priv_protocol?: "des" | "aes" | "aes256b" | "aes256r"
  priv_key?: string
}

export type VersionConfig = "1" | 1 | "2c" | 3 | "3"

export type InterfaceAttribute =
  | "oper_status"
  | "admin_status"
  | "speed_mbps"
  | "rx_bytes"
  | "tx_bytes"
  | "alias"

export type JuniperVlanAttribute =
  | "mode"
  | "native_vlan"
  | "vlans"
  | "tagged_vlans"
  | "untagged_vlans"
  | "summary"

export interface SensorConfig {
  oid?: string
  source?: "snmp" | "juniper_ex_vlan" | "interface"
  interface?: string
  interfaces?: string[]
  attribute?: InterfaceAttribute | JuniperVlanAttribute
  name: string
  object_id?: string
  transform?: string
  template?: string
  unit_of_measurement?: string
  device_class?: string
  state_class?: string
  entity_category?: string
  icon?: string
  binary_sensor?: boolean
  availability_mode?: "all" | "any" | "latest" | "online"
}

export interface Config {
  log: LogLevelStrings
  mqtt: MQTTConfig
  homeassistant: HomeAssistantConfig
  targets: Array<TargetConfig>
}

export interface HomeAssistantConfig {
  discovery: boolean
  prefix: string
}
