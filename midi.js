window.midi = (function() {

    var listenersCreated = 0;
    var listeners = {};

    var midi = {

        access: null,

        types: {
            0x8: { name: "noteOff",           params: ["note", "velocity"] },
            0x9: { name: "noteOn",            params: ["note", "velocity"] },
            0xA: { name: "noteAftertouch",    params: ["note", "value"] },
            0xB: { name: "controller",        params: ["controllerNumber", "value"] },
            0xC: { name: "programChange",     params: ["programNumber"] },
            0xD: { name: "channelAftertouch", params: ["value"] },
            0xE: { name: "pitchBend",         params: ["lowValue", "highValue"] }
        },

        onmessage: function(decoded, raw) {

        },

        on: function(filter, callback, scope) {
            
            var lid = listenersCreated++;
            
            listeners[lid] = {
                callback: callback,
                filter: filter,
                scope: scope
            };

            return {
                off: function() {
                    delete listeners[lid]; 
                }
            }

        }

    };

    midi.Player = function() {
        this.position = 0;
    };

    midi.Player.prototype.play = function() {

    };

    midi.Player.prototype.pause = function() {

    };

    midi.Player.prototype.update = function() {

    };

    midi.Player.prototype.setPosition = function(position) {

    };

    function error(msg) {
        return function() {
            console.error('MIDI: ' + msg);
        }
    }

    function onAccess(callback) {        
        
        return function(access) {
        
            console.log('MIDI Ready!');
            
            midi.access = access;
            midi.inputs = access.inputs();
            console.groupCollapsed('Inputs');

            for (var x = 0; x < midi.inputs.length; x++) {
                console.log(midi.inputs[x].name, midi.inputs[x]);
                midi.inputs[x].onmidimessage = onMessage;
            }

            console.groupEnd();

            callback && callback();

        }

    }

    function onMessage(e) {
        
        var decoded = decodeMessage(e);
        
        midi.onmessage(decoded, e);
        
        for (var i in listeners) {
            
            var l = listeners[i];
            var match = true;

            for (var p in l.filter) {

                var v = l.filter[p];

                if (v.apply) {
                    match = match && v(decoded[p]);
                } else { 
                    match = match && v === decoded[p];
                }

            }

            if (match) {
                l.callback.call(l.scope, decoded, e)
            }

        }

    }

    function decodeMessage(msg) {
        var type = midi.types[(msg.data[0] & 0xf0) >> 4];
        var decoded = {
            type: type.name,
            channel: (msg.data[0] & 0x0f) + 1,
        };
        type.params.forEach(function(param, index) {
            decoded[param] = msg.data[index + 1];
        });
        return decoded;
    }

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onAccess(), error('Failed to get midi access'));
    } else { 
        error('Web MIDI is not enabled')();
    }

    return midi;

})();