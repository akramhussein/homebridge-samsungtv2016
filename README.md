# Homebridge-samsungtv2016

Samsung TV plugin for [Homebridge](https://github.com/nfarina/homebridge)

This allows you to control your 2016 Samsung TV with HomeKit and Siri.

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-samsungtv2016
3. Update your configuration file. See `config-sample.json`.

## Config

* `accessory` = SamsungTV2016 (do not change).
* `name` - Can change to anything you want.
* `ip_address` - IP Address of your TV.
* `mac_address` - MAC Address of your TV. If you don't set it, programme will try and get it from the TV's API.
