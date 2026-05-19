'use strict';

const Homey = require('homey');
const crypto = require('crypto');
const { DEFAULT_DOMAIN } = require('../../lib/foxess-client');

class FoxEssInverterDriver extends Homey.Driver {
  async onInit() {
    this.log('FoxESS inverter driver initialized');
  }

  async onPair(session) {
    this.log('FoxESS pairing session started');
    session.setHandler('showView', async viewId => {
      this.log(`FoxESS pairing view shown: ${viewId}`);
    });

    session.setHandler('list_devices', async () => {
      this.log('FoxESS list_devices requested');

      return [
        {
          name: this.homey.__('pair.default_device_name'),
          data: {
            id: crypto.randomUUID(),
          },
          settings: {
            api_key: '',
            serial_number: '',
            domain: DEFAULT_DOMAIN,
            poll_interval: 300,
          },
          store: {
            created_at: new Date().toISOString(),
          },
        },
      ];
    });
  }
}

module.exports = FoxEssInverterDriver;
