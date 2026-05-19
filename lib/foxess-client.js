'use strict';

const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_DOMAIN = 'https://www.foxesscloud.com';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_VARIABLES = [
  'SoC',
  'loadsPower',
  'feedinPower',
  'pvPower',
  'meterPower2',
  'batDischargePower',
  'batChargePower',
  'gridConsumptionPower',
  'runningState',
];

class FoxEssClient {
  constructor({
    apiKey,
    serialNumber,
    domain = DEFAULT_DOMAIN,
    variables = DEFAULT_VARIABLES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }) {
    this.apiKey = apiKey;
    this.serialNumber = serialNumber;
    this.domain = domain;
    this.variables = variables;
    this.timeoutMs = timeoutMs;
  }

  getSignature(token, path, lang = 'en') {
    const timestamp = Date.now().toString();
    const signaturePlaintext = `${path}\\r\\n${token}\\r\\n${timestamp}`;

    const signature = crypto
      .createHash('md5')
      .update(signaturePlaintext, 'utf8')
      .digest('hex');

    return {
      token,
      lang,
      timestamp,
      signature,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    };
  }

  async request(method, path, params = null) {
    const fullUrl = new URL(path, this.domain);
    const headers = this.getSignature(this.apiKey, path);

    const options = {
      method: method.toUpperCase(),
      family: 4,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    };

    if (method.toLowerCase() === 'get' && params) {
      for (const [key, value] of Object.entries(params)) {
        fullUrl.searchParams.append(key, value);
      }
    }

    return new Promise((resolve, reject) => {
      const req = https.request(fullUrl, options, res => {
        let body = '';

        res.on('data', chunk => {
          body += chunk.toString();
        });

        res.on('end', () => {
          if (!body) {
            return reject(new Error(`FoxESS returned an empty response with HTTP ${res.statusCode}`));
          }

          let parsed;

          try {
            parsed = JSON.parse(body);
          } catch (error) {
            return reject(new Error(`FoxESS JSON parse error: ${error.message}`));
          }

          if (res.statusCode && res.statusCode >= 400) {
            const message = parsed.message || parsed.msg || `FoxESS HTTP ${res.statusCode}`;
            return reject(new Error(message));
          }

          resolve(parsed);
        });
      });

      req.on('error', reject);
      req.setTimeout(this.timeoutMs, () => {
        req.destroy(new Error(`FoxESS request timed out after ${this.timeoutMs}ms`));
      });

      if (method.toLowerCase() !== 'get' && params) {
        req.write(JSON.stringify(params));
      }

      req.end();
    });
  }

  async deviceRealQuery() {
    return this.request('post', '/op/v0/device/real/query', {
      sn: this.serialNumber,
      variables: this.variables,
    });
  }

  static extractValues(result) {
    const datas = result?.result?.[0]?.datas
      || result?.response?.result?.[0]?.datas
      || [];

    const values = {};

    for (const item of datas) {
      const variable = item.variable;
      const numericValue = Number.parseFloat(item.value);

      values[variable] = Number.isFinite(numericValue) ? numericValue : item.value;
      values[`${variable}_unit`] = item.unit || '';
    }

    return values;
  }
}

module.exports = {
  DEFAULT_DOMAIN,
  DEFAULT_VARIABLES,
  FoxEssClient,
};
