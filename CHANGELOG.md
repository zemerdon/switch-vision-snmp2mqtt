# Changelog

## 0.9.3

- Serialize MQTT publishes through one shared queue to prevent socket `drain` listener accumulation during large discovery and startup bursts.
- Preserve publish error propagation while keeping the queue usable after failures.
- Wait for queued publishes before closing the MQTT client.

## 0.9.2

- Replaced private package-registry URLs in `yarn.lock` with the public Yarn registry.
- Added explicit public Yarn and npm registry configuration.
- Retains the immediate startup polling fix from v0.9.1.

## 0.9.1

- Delay initial target polling for two seconds after Home Assistant MQTT discovery is published, preventing non-retained startup values from being missed.
- Poll every target once immediately when it starts or resumes, then continue at its configured scan interval.
- Clear any existing target interval before resuming to prevent duplicate polling timers after MQTT reconnects.

## 0.9.0

- Rename the project to Switch Vision SNMP2MQTT.
- Rename package and repository metadata to `switch-vision-snmp2mqtt`.
- Change startup branding to Switch Vision.
- Move Cisco-specific placeholder helpers under `src/vendors/cisco/`.
- Preserve the upstream SNMP polling and MQTT behaviour.
