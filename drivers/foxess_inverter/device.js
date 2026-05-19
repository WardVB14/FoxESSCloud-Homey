'use strict';

const Homey = require('homey');
const { DEFAULT_DOMAIN, FoxEssClient } = require('../../lib/foxess-client');

const DEFAULT_POLL_INTERVAL_SECONDS = 300;
const DEFAULT_BATTERY_CAPACITY_KWH = 5.12;
const RUNNING_STATE_MAP = {
  160: 'self-test',
  161: 'waiting',
  162: 'checking',
  163: 'on-grid',
  164: 'off-grid',
  165: 'fault',
  166: 'permanent-fault',
  167: 'standby',
  168: 'upgrading',
  169: 'fct',
  170: 'illegal',
};
const REQUIRED_CAPABILITIES = [
  'measure_battery',
];

function describeError(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (error instanceof Error) {
    return error.stack || error.message || error.toString();
  }

  if (typeof error === 'object') {
    try {
      return JSON.stringify(error);
    } catch (jsonError) {
      return String(error);
    }
  }

  return String(error);
}

class FoxEssInverterDevice extends Homey.Device {
  async onInit() {
    this.pollTimeout = null;
    this.isPolling = false;

    this.log(`FoxESS inverter initialized for ${this.getName()}`);

    this.registerCapabilityListener('button_refresh_data', async () => {
      await this.poll(true);
    });

    await this.migrateLegacySettings();
    await this.ensureCapabilities();
    await this.ensureState();
    this.startPolling();
  }

  async onAdded() {
    this.log(`FoxESS inverter added: ${this.getName()}`);
  }

  async onDeleted() {
    this.stopPolling();
  }

  async onRenamed(name) {
    this.log(`FoxESS inverter renamed to ${name}`);
  }

  async onSettings({ newSettings, changedKeys }) {
    if (changedKeys.length === 0) {
      return;
    }

    if (changedKeys.some(key => ['api_key', 'serial_number', 'domain', 'poll_interval', 'battery_capacity_kwh'].includes(key))) {
      this.log(`Settings updated for ${this.getName()}, restarting polling`);
      this.stopPolling();
      this.client = this.createClient(newSettings);
      await this.ensureState();
      this.startPolling();
    }
  }

  async migrateLegacySettings() {
    const settings = this.getSettings();
    const updates = {};

    if (!settings.api_key && settings.apiKey) {
      updates.api_key = settings.apiKey;
    }

    if (!settings.serial_number && settings.sn) {
      updates.serial_number = settings.sn;
    }

    if (Object.keys(updates).length > 0) {
      await this.setSettings(updates);
    }
  }

  async ensureCapabilities() {
    for (const capabilityId of REQUIRED_CAPABILITIES) {
      if (!this.hasCapability(capabilityId)) {
        await this.addCapability(capabilityId);
      }
    }
  }

  createClient(settings = this.getSettings()) {
    return new FoxEssClient({
      apiKey: settings.api_key,
      serialNumber: settings.serial_number,
      domain: settings.domain || DEFAULT_DOMAIN,
    });
  }

  getPollIntervalMs(settings = this.getSettings()) {
    const seconds = Number.parseInt(settings.poll_interval, 10);
    const safeSeconds = Number.isFinite(seconds) && seconds >= 60
      ? seconds
      : DEFAULT_POLL_INTERVAL_SECONDS;

    return safeSeconds * 1000;
  }

  getBatteryCapacityKwh(settings = this.getSettings()) {
    const capacity = Number.parseFloat(settings.battery_capacity_kwh);

    if (Number.isFinite(capacity) && capacity > 0) {
      return capacity;
    }

    return DEFAULT_BATTERY_CAPACITY_KWH;
  }

  async ensureState() {
    const settings = this.getSettings();

    if (!settings.api_key || !settings.serial_number) {
      await this.setUnavailable(this.homey.__('device.errors.missing_credentials'));
      return;
    }

    this.client = this.createClient(settings);
    await this.setAvailable();
  }

  startPolling() {
    this.scheduleNextPoll(0);
  }

  stopPolling() {
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }
  }

  scheduleNextPoll(delayMs = this.getPollIntervalMs()) {
    this.stopPolling();
    this.pollTimeout = setTimeout(() => {
      this.poll().catch(error => {
        this.error('Unexpected poll failure', error);
      });
    }, delayMs);
  }

  async poll(manual = false) {
    if (this.isPolling) {
      return;
    }

    const settings = this.getSettings();

    if (!settings.api_key || !settings.serial_number) {
      await this.setUnavailable(this.homey.__('device.errors.missing_credentials'));
      return;
    }

    this.isPolling = true;

    try {
      const result = await this.client.deviceRealQuery();
      const values = FoxEssClient.extractValues(result);

      await this.applyValues(values);
      await this.setStoreValue('last_poll_at', new Date().toISOString());
      await this.setAvailable();
    } catch (error) {
      const description = describeError(error);
      this.error(`FoxESS poll failed for ${this.getName()}: ${description}`);
      await this.setUnavailable(description);

      if (manual) {
        throw error;
      }
    } finally {
      this.isPolling = false;
      this.scheduleNextPoll();
    }
  }

  async applyValues(values) {
    const capabilityMap = {
      SoC: ['measure_battery', 'measure_battery_soc'],
      loadsPower: 'measure_power',
      feedinPower: 'measure_power_feedin',
      pvPower: 'measure_power_meter_2',
      batDischargePower: 'measure_power_battery_discharge',
      batChargePower: 'measure_power_battery_charge',
      gridConsumptionPower: 'measure_power_grid_consumption',
    };

    for (const [sourceKey, capabilityIds] of Object.entries(capabilityMap)) {
      if (!Object.prototype.hasOwnProperty.call(values, sourceKey)) {
        continue;
      }

      const capabilityIdList = Array.isArray(capabilityIds)
        ? capabilityIds
        : [capabilityIds];

      const normalizedValue = sourceKey === 'SoC'
        ? values[sourceKey]
        : values[sourceKey] * 1000;

      for (const capabilityId of capabilityIdList) {
        if (!this.hasCapability(capabilityId)) {
          continue;
        }

        await this.setCapabilityValue(capabilityId, normalizedValue);
      }
    }

    if (Object.prototype.hasOwnProperty.call(values, 'runningState') && this.hasCapability('measure_running_state')) {
      const rawState = Number.parseInt(values.runningState, 10);
      const mappedState = RUNNING_STATE_MAP[rawState];

      if (mappedState) {
        await this.setCapabilityValue('measure_running_state', mappedState);
      }
    }

    if (Object.prototype.hasOwnProperty.call(values, 'SoC') && this.hasCapability('measure_battery_energy')) {
      const batteryCapacityKwh = this.getBatteryCapacityKwh();
      const batteryEnergyKwh = (Number.parseFloat(values.SoC) / 100) * batteryCapacityKwh;

      if (Number.isFinite(batteryEnergyKwh)) {
        await this.setCapabilityValue('measure_battery_energy', Number.parseFloat(batteryEnergyKwh.toFixed(2)));
      }
    }
  }
}

module.exports = FoxEssInverterDevice;
