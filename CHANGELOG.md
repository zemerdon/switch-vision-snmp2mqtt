# Changelog

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
