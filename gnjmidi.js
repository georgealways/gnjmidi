// bits of prettymidi
// https://github.com/nick-thompson/prettymidi

window.midi = (function() {

    var listenersCreated = 0;
    var listeners = {};

    var midi = {

        access: null,

        debug: false,

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
            if (midi.debug) {
                console.log(decoded);
            }
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

    midi.Player = function(path) {
        this.position = 0;
        this.lastPosition = this.position;
        this.path = path;
        this.playing = false;
        this.time = undefined;
        this.lastTime = undefined;
    };

    midi.Player.prototype.load = function(callback) {
        
        var _this = this;
        
        var xhr = new XMLHttpRequest();
        xhr.open('GET', this.path, true);
        xhr.responseType = 'arraybuffer';

        xhr.onload = function() {
            
            _this.buffer = xhr.response;
            _this.midiFile = new MIDIFile(_this.buffer);

            _this.events = _this.midiFile.getMidiEvents();
            _this.events.forEach(function(e, i) {
                e.data = [
                        (e.subtype << 4) + e.channel,
                        e.param1,
                        e.param2 || 0x00
                    ];
                // Store for non-realtime acquisition.
                var decoded = decodeMessage(e);
                for (var k in decoded) {
                    e[k] = decoded[k];
                }
            });
            _this.events.sort(function(a, b) {

                var diff = a.playTime - b.playTime;
                if (diff == 0) {
                    return a.type == 'noteOff' ? -1 : 1;
                }
                return diff;

            });

            callback && callback();

        };

        xhr.send(null);

    }

    midi.Player.prototype.play = function() {
        if (this.playing) return;
        this.playing = true;
        this.time = this.lastTime = now();
    };

    midi.Player.prototype.pause = function() {
        if (!this.playing) return;
        this.playing = false;
    };

    midi.Player.prototype.update = function(position) {

        if (!this.playing) return;

        this.lastTime = this.time;
        this.time = now();

        this.lastPosition = this.position;
        
        if (position === undefined) {
            this.position += this.time - this.lastTime;
        } else { 
            this.position = position;
        }

        var t, e, lastEvent;

        for (var i in this.events) {
            e = this.events[i];
            t = e.playTime;

            if (t > this.lastPosition && t <= this.position) {
                // lastEvent = e;
                // e.data has been assigned in Player.load
                onMessage(e); 
            }
        }

        // if (lastEvent) {
        //     onMessage({
        //         data: [
        //             (lastEvent.subtype << 4) + lastEvent.channel,
        //             lastEvent.param1,
        //             lastEvent.param2 || 0x00
        //         ]
        //     });  
        // }            


    };

    midi.Player.prototype.setPosition = function(position) {
        this.position = position;
        this.lastPosition = position;
    };

    function error(msg) {
        return function() {
            console.error('MIDI: ' + msg);
        }
    }

    function warn(msg) {
        return function() {
            console.warn('MIDI: ' + msg);
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

    function now() {
        return (+ new Date());
    }

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onAccess(), error('Failed to get midi access'));
    } else { 
        warn('Web MIDI is not enabled')();
    }

    return midi;

})();