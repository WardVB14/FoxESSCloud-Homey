'use strict';

const Homey = require('homey');

class FoxEssCloudApp extends Homey.App {
  async onInit() {
    this.log('FoxESS Cloud app initialized');
  }
}

module.exports = FoxEssCloudApp;
