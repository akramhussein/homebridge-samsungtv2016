var WebSocket = require('ws');
var wol = require('wake_on_lan');
var inherits = require('util').inherits;
var request = require('request');

var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-samsungtv", "SamsungTV2016", SamsungTv2016Accessory);
};

//
// SamsungTV2016 Accessory
//

function SamsungTv2016Accessory(log, config) {
    this.log = log;
    this.config = config;
    this.name = config["name"];
    this.mac_address = config["mac_address"];
    this.ip_address = config["ip_address"];
    this.api_timeout = config["api_timeout"] || 2000;
    this.is_powering_off = false;
    this.send_delay = config["send_delay"] || 500;;

    // Required config
    if (!this.ip_address) throw new Error("You must provide a config value for 'ip_address'.");
    if (!this.mac_address) throw new Error("You must provide a config value for 'mac_address'.");

    // Generate app name to provide TV
    this.app_name_base64 = (new Buffer(config["app_name"] || "homebridge")).toString('base64');

    // Wake-on-Lan
    this.wake = function(error) {
      wol.wake(this.mac_address, function(wakeError) {
        if (wakeError) {
          log("Failed to wake TV via Wake-on-Lan")
          error(true);
        } else {
          log("Successfully woke TV via Wake-On-Lan")
          error(false);
        }
      });
    };

    // Send a key command
    this.sendKey = function(key, error) {
      // Setup Web Socket
      ws = new WebSocket('http://' + this.ip_address + ':8001/api/v2/channels/samsung.remote.control?name=' + this.app_name_base64);

      ws.on('open', function open() { log("WebSocket open"); });

      ws.on('close', function close() { log('WebSocket disconnected'); });

      ws.on('connection', function connection(ws) { log('WebSocket connected'); });

      ws.on('message', function message(data, flags) {
        log('Message received: %s', data);

        var cmd =  {
          "method": "ms.remote.control",
          "params": {
            "Cmd": "Click",
            "DataOfCmd": key,
            "Option": "false",
            "TypeOfRemote":"SendRemoteKey"
          }
        };

        data = JSON.parse(data);

        if(data.event == "ms.channel.connect") {
            setTimeout(function timeout() {
              log('Sending cmd to TV');
              ws.send(JSON.stringify(cmd), function ack(sendError) {
                if (sendError) {
                  log("Failed to send cmd to TV");
                  error(true);
                } else {
                  log("Successfully sent cmd to TV");
                  error(false);
                }
                ws.close();
              });
            }, this.send_delay);
        } else {
          error(true);
        }
      });
    };

    this.service = new Service.Switch(this.name);

    // Check if we can reach the TV
    this.tvReachable = function(reachable) {
      request.get({ url: 'http://' + this.ip_address + ':8001/api/v2/', timeout: this.api_timeout}, function(err, res, body) {
        if(!err && res.statusCode === 200) {
          log('TV API is active');
          reachable(true);
        } else {
          log('No response from TV');
          reachable(false);
        }
      });
    };

    this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this._getOn.bind(this))
        .on('set', this._setOn.bind(this));
}

SamsungTv2016Accessory.prototype.getInformationService = function() {
    var informationService = new Service.AccessoryInformation();
    informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, 'Samsung TV')
        .setCharacteristic(Characteristic.Model, '1.0.0')
        .setCharacteristic(Characteristic.SerialNumber, this.ip_address);
    return informationService;
};

SamsungTv2016Accessory.prototype.getServices = function() {
    return [this.service, this.getInformationService()];
};

SamsungTv2016Accessory.prototype._getOn = function(callback) {
    var accessory = this;

    if(accessory.is_powering_off) {
      accessory.log('Power off in progress, reporting status as off.');
      callback(null, false);
    } else {
      // if we can access the info API, then assume the TV is on
      // there is a short period of time after the TV is turned off where the API is still active
      // so this isn't bulletproof.
      this.tvReachable( function(active) {
        callback(null, active);
      });
    }
};

SamsungTv2016Accessory.prototype._setOn = function(on, callback) {
    var accessory = this;
    accessory.log('Received ON command: ' + on);

    if (on) {
      accessory.tvReachable(function(alive) {
        if(alive) {
          accessory.log('Sending power key');
          accessory.sendKey('KEY_POWER', function(err) {
              if (err) {
                  callback(new Error(err));
              } else {
                  // command has been successfully transmitted to your tv
                  accessory.log('Successfully powered on tv');
                  accessory.is_powering_off = false;
                  callback(null);
              }
          });
        } else {
          accessory.log('Attempting wake');
          accessory.wake(function(err) {
              if (err) {
                  callback(new Error(err));
              } else {
                  // command has been successfully transmitted to your tv
                  accessory.log('Successfully woke tv');
                  callback(null);
              }
          });
        }
      });
    } else {
        accessory.log('Sending power key');
        accessory.sendKey('KEY_POWER', function(err) {
            if (err) {
                callback(new Error(err));
            } else {
                // command has been successfully transmitted to your tv
                accessory.log('Successfully powered off tv');
                accessory.is_powering_off = true;
                setTimeout(function() { accessory.is_powering_off = false;}, 15000)
                callback(null);
            }
        });
    }
};
