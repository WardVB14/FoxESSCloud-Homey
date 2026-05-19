# FoxESS Cloud Homey App

This app utilises an API call to the FoxESS Cloud to pull data for inverter and battery systems via a Homey SDK v3 app structure.

It is a modified version the foxesscloud-homey app by crazy-gray-v8
Check out his version here: https://github.com/crazy-gray-v8/foxesscloud-homey

This version was build for my setup so changes my be needed to fit your install.

Inverter model: H1-5.0-E1
Battery model: HV2600

This app show the home use in the Homey energy app and the battery soc in the Homey battery app

## What it does

- pairs a FoxESS inverter through Homey's built-in device list flow
- stores the FoxESS API key, serial number, domain and poll interval per device
- polls FoxESS Cloud on an interval
- updates Homey capabilities for battery state of charge and power values

## Edit here

Use these as the source files when you make changes:

- `app.js`: app startup
- `lib/foxess-client.js`: FoxESS API requests and polling helpers
- `drivers/foxess_inverter/driver.js`: pairing logic
- `drivers/foxess_inverter/device.js`: device behavior and capability updates
- `drivers/foxess_inverter/driver.compose.json`: driver manifest, pairing flow, settings, capabilities
- `.homeycompose/app.json`: app manifest source of truth
- `.homeycompose/capabilities/*.json`: custom capability labels and metadata
- `locales/en.json`: user-facing strings

## Avoid editing

- `.homeybuild/`: generated build output
- `app.json`: generated from Homey Compose, keep `.homeycompose/app.json` as the source of truth

## Structure

- `app.js`: Homey app entry point
- `lib/foxess-client.js`: FoxESS HTTP client extracted from your script
- `drivers/foxess_inverter/device.js`: per-device polling lifecycle
- `.homeycompose/capabilities/*.json`: custom capabilities for FoxESS-specific metrics

# To install this on your Homey device:

- Read the Getting started with Homey CLI app first
- Install Node.js v22 or higher
- Open a terminal window and run this command "npm install --global homey" to install the Homey CLI
- Navigate to the folder where the the app files are located for example cd C:\Users\admin\old.com.company.myapp
- Follow the commands below

## Running

Use the Homey CLI against this directory, for example:

```via Windows powershell:
homey login (a webpage should open to login to your Homey account. This is needed to upload the app to your Homey)
# You should now see that you are loged in with your account
homey list (this will give you the Homey devices linked to your account)
cd C:\Users\admin\old.com.company.myapp replace "C:\Users\admin\old.com.company.myapp" with the folder where the app files are located
homey app compose
homey app install (this will install the app to your Homey )
```

# On your Homey app
- Click + to add a new device and select the FoxESS Cloud app
- Select FoxESS Inverter and assing to a room if wanted
- After install you will get the notification that the API key or serial number are missing
- Long press the device and click the settings icon
- Click on Advanced settings
- Fill in your/
    - API key
    - Serial number of your inverter
    - A different API url if you have changed this in your inverters settings
    - Poll interval (when the system does a call to the cloud to check for changes) Keep in mind Fox has a limit of max 1440 calls per day
    - Battery capacity

# FoxESSCloud info
You can create a new API key on https://www.foxesscloud.com
- Login and click on your user icon
- Navigate to User Profile --> API Management and click on Generate API key (make sure to save this, it will only display one time)

To get your Inverter serial number, again go to https://www.foxesscloud.com
- Login and click on Device ---> Inverter
- Serial number is shown as Inverter SN
