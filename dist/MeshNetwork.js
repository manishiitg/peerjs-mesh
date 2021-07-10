"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _MeshHost = _interopRequireDefault(require("./MeshHost"));

var _MeshPeer = _interopRequireDefault(require("./MeshPeer"));

var _uuid = require("uuid");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const EventEmitter = require('events');
/**
 * Mesh Network class is responsible for managing the peers inside a mesh and also the host
 * It will manage the different type of mesh modes i.e host/full mesh
 * A client application will only interact with the MeshNetwork class
 */


class MeshNetwork extends EventEmitter {
  constructor(room, options) {
    super();

    _defineProperty(this, "options", {});

    _defineProperty(this, "currentPeer", false);

    _defineProperty(this, "isjoined", false);

    _defineProperty(this, "issync", false);

    _defineProperty(this, "id", false);

    _defineProperty(this, "hostPeer", false);

    _defineProperty(this, "hostDataConnection", false);

    _defineProperty(this, "_peerlist", []);

    _defineProperty(this, "addPeer", () => {
      this.currentPeer = new _MeshPeer.default(this.options);
      this.currentPeer.connectNetwork(this.room);
      let joinTimeout = false;

      if (this.options.join_timeout !== -1) {
        joinTimeout = setTimeout(() => {
          this.isjoined = false;
          this.emit("error", "Peer timed out before joining network");
          this.cleanup(); //if we don't clean peer still tries to connect to network
        }, this.options.join_timeout);
      }

      this.currentPeer.on("joined", id => {
        joinTimeout && clearTimeout(joinTimeout);

        if (this.currentPeer) {
          this.id = id;
          this.emit("joined", id);
          this.isjoined = true;

          this._listenPeerEvents();

          this._syncMesh();
        } else {
          console.error("{" + this.options.log_id + "} ", "this is unexpected as this means cleanup was called before joined but event still fired");
          this.emit("error", "this is unexpected as this means cleanup was called before joined but event still fired");
        }
      });
      this.currentPeer.on("left", (id, err) => {
        this.isjoined = false;
        console.warn("{" + this.options.log_id + "} ", "error in mesh network", err);
        this.emit("error", err);
      });
    });

    _defineProperty(this, "_addInternalPeer", id => {
      if (this._peerlist.indexOf(id) === -1) {
        this._peerlist.push(id);

        if (id !== this.id) this.emit("peerjoined", id, this._peerlist);
      }
    });

    _defineProperty(this, "_removeAllInternalPeers", () => {
      this._peerlist.filter(p => {
        this.emit("peerdropped", p);
      });

      this._peerlist = [];
      this.currentPeer.closeAllConnections();
    });

    _defineProperty(this, "_removeInternalPeer", id => {
      if (this._peerlist.indexOf(id) >= 0) {
        this._peerlist = this._peerlist.filter(p => p !== id);
        this.emit("peerdropped", id, this._peerlist);
      }
    });

    _defineProperty(this, "_listenPeerJoined", id => {
      console.log("{" + this.options.log_id + "} ", "new peer added to mesh", id);

      this._addInternalPeer(id);
    });

    _defineProperty(this, "_listenPeerDropped", id => {
      this._removeInternalPeer(id);
    });

    _defineProperty(this, "_listenDropped", err => () => {
      this._syncMesh = false;
      this.emit("dropped", err);
    });

    _defineProperty(this, "_listenSync", connectedPeers => {
      console.log("{" + this.options.log_id + "} ", "sync completed", connectedPeers);
      this.issync = true;
      this.emit("sync", connectedPeers);
      this._peerlist = []; // when a host drops a new host is created and we get all connectedPeers from that

      connectedPeers.forEach(peer => {
        this._addInternalPeer(peer);
      });
      this._syncStarted = false;
    });

    _defineProperty(this, "_listenError", err => {
      if (err.type && err.type === "peer-unavailable") {
        if (err.toString().indexOf(this.room)) {
          //if error is related to host not avaiable there is no need to emit it
          return;
        }
      }

      this.hostDataConnection = null; //TODO add this very rcently, test properly

      this.emit("error", err);
    });

    _defineProperty(this, "_listenHostDropped", () => {
      if (this.options.owner_mode) {
        if (!this.options.is_owner) {
          this._removeAllInternalPeers();
        }
      }

      console.log("{" + this.options.log_id + "} ", "host has dropped this is a major issue need to create a new host");
      this.hostPeer = null;
      this.hostDataConnection = null;
      this.emit("sync", false);
      this.emit("hostdropped");

      this._syncMesh();
    });

    _defineProperty(this, "_listenData", (data, id) => this.emit("data", data, id));

    _defineProperty(this, "_listenStream", (stream, id) => this.emit("stream", stream, id));

    _defineProperty(this, "_listenStreamDrop", id => this.emit("streamdrop", id));

    _defineProperty(this, "_listenInitData", (id, data) => this.emit("initData", id, data));

    _defineProperty(this, "_meshTries", 0);

    _defineProperty(this, "_listenMeshLimitExceeded", limit => {
      this.emit("meshlimitexceeded", limit, this._meshTries); // this.cleanup()

      setTimeout(() => {
        this._syncStarted = false;

        this._syncMesh();

        this._meshTries = this._meshTries + 1;
      }, 5000);
    });

    _defineProperty(this, "_listenPeerEvents", () => {
      this.currentPeer.on("peerjoined", this._listenPeerJoined);
      this.currentPeer.on("peerdropped", this._listenPeerDropped);
      this.currentPeer.on("sync", this._listenSync);
      this.currentPeer.on("error", this._listenError);
      this.currentPeer.on("data", this._listenData);
      this.currentPeer.on("hostdropped", this._listenHostDropped);
      this.currentPeer.on("stream", this._listenStream);
      this.currentPeer.on("streamdrop", this._listenStreamDrop);
      this.currentPeer.on("initData", this._listenInitData);
      this.currentPeer.on("meshlimitexceeded", this._listenMeshLimitExceeded);
      this.currentPeer.on("dropped", this._listenDropped);
      this.currentPeer.on("error-peer-unavailable", err => {
        if (this.options.owner_mode) {
          if (!this.options.is_owner) {
            console.log("running on owner mode, but you are not owner so need to wait for owner to connect! trying again in ...", this.options.retry_interval, "mili-sec");
            this.emit("host-unavailable");
            setTimeout(() => {
              this._connectToHost();
            }, this.options.retry_interval);
            return;
          }
        }

        let host = new _MeshHost.default(this.options);
        if (this.options.owner_mode) if (this.options.is_owner) host.setOwnerId(this.currentPeer.id);
        host.connectNetwork(this.room);
        host.on("created", peer => {
          console.log("{" + this.options.log_id + "} ", " host created ", peer);
          this.hostPeer = host;
          let dc = this.currentPeer.connectWithPeer(this.room);
          dc.on("open", () => {
            console.log("{" + this.options.log_id + "} ", "data connection opened with host");
            this.hostDataConnection = dc;
            this.emit("hostconnected", true);
            console.log("{" + this.options.log_id + "} ", "check pending messages from here 368");

            this._checkPendingMessages();
          });
        });
        host.on("exists", () => {
          console.log("{" + this.options.log_id + "} ", " host exists ");
          let dc = this.currentPeer.connectWithPeer(this.room);
          dc.on("open", () => {
            console.log("{" + this.options.log_id + "} ", "data connection opened with host");
            this.hostDataConnection = dc;
            this.emit("hostconnected", false);
            console.log("{" + this.options.log_id + "} ", "check pending messages from here 379");

            this._checkPendingMessages();
          });
        });
      });
    });

    _defineProperty(this, "_closePeerEvents", () => {
      if (!this.currentPeer) return;
      this.currentPeer.off("peerjoined", this._listenPeerJoined);
      this.currentPeer.off("peerdropped", this._listenPeerDropped);
      this.currentPeer.off("sync", this._listenSync);
      this.currentPeer.off("error", this._listenError);
      this.currentPeer.off("data", this._listenData);
      this.currentPeer.off("hostdropped", this._listenHostDropped);
      this.currentPeer.off("stream", this._listenStream);
      this.currentPeer.off("streamdrop", this._listenStreamDrop);
      this.currentPeer.off("initData", this._listenInitData);
      this.currentPeer.off("meshlimitexceeded", this._listenMeshLimitExceeded);
      this.currentPeer.off("dropped", this._listenDropped);
    });

    _defineProperty(this, "isJoined", () => this.isjoined);

    _defineProperty(this, "waitToJoin", () => {
      if (this.isjoined) {
        return Promise.resolve(true);
      } else {
        return new Promise((resolve, reject) => {
          let timeout = setTimeout(() => {
            reject("timeout");
          }, this.options.join_timeout);
          this.on("joined", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
    });

    _defineProperty(this, "getPeers", () => {
      if (this.options.mesh_mode === "host") {
        return this._peerlist;
      } else {
        return this.currentPeer.getPeers();
      }
    });

    _defineProperty(this, "_messageToSend", []);

    _defineProperty(this, "_checkPendingMessages", () => {
      if (this.options.mesh_mode === "host") {
        if (this._messageToSend.length > 0) {
          console.log("{" + this.options.log_id + "} ", "this._messageToSend.length", this._messageToSend.length);

          this._messageToSend.forEach(data => {
            this.hostDataConnection.send({ ...data,
              "ispending": true,
              "peerid": this.id,
              "unique": (0, _uuid.v4)()
            });
          });

          this._messageToSend = [];
        }
      }

      if (this.currentPeer._getCurrentStream()) {
        this.call(this.currentPeer._getCurrentStream());
      }

      if (this._dataToPersist) {
        this.initData(this._dataToPersist);
      }
    });

    _defineProperty(this, "send", (data, to_peer = false) => {
      if (!this.isjoined || this.sync) {
        if (this._peerlist.length > 0) this._messageToSend.push({
          "data": data,
          "peerlist": to_peer ? [to_peer] : this._peerlist,
          "to_peer": to_peer
        });
        console.log("{" + this.options.log_id + "} ", "Can send data only once peer has synced with the network");
        return;
      }

      if (this.options.mesh_mode === "host") {
        console.log("{" + this.options.log_id + "} ", 'this.hostDataConnection', this.hostDataConnection);

        if (!this.hostDataConnection || !this.hostDataConnection.open) {
          console.log("{" + this.options.log_id + "} ", "adding data to local cache to send once host connection is established", data, this._messageToSend);
          if (this._peerlist.length > 0) this._messageToSend.push({
            "data": data,
            "peerlist": to_peer ? [to_peer] : this._peerlist,
            "to_peer": to_peer
          });
        } else {
          let msg_id = (0, _uuid.v4)();
          this.hostDataConnection.send({
            "message": data,
            "id": msg_id,
            "to_peer": to_peer
          });

          this._messageToSend.push({
            "data": data,
            "peerlist": to_peer ? [to_peer] : this._peerlist,
            "msg_id": msg_id,
            "to_peer": to_peer
          });

          this.hostDataConnection.on("data", data => {
            if (data.message_reciept) {
              if (this._messageToSend) this._messageToSend.filter(msg => msg.msg_id !== data.message_reciept);
            }
          });
          this.hostDataConnection.on("error", err => {
            console.log("{" + this.options.log_id + "} ", " r", err);
          });
          this.hostDataConnection.on("close", () => {
            console.log("{" + this.options.log_id + "} ", "host data connection close");
          });
        }
      } else {
        if (to_peer) {
          this.currentPeer.sendData(to_peer, data);
        } else {
          this.getPeers().forEach(id => {
            this.currentPeer.sendData(id, data);
          });
        }
      }
    });

    _defineProperty(this, "mute", (muted = true) => {
      this.currentPeer._mute(muted);
    });

    _defineProperty(this, "_silence", () => {
      let ctx = new AudioContext(),
          oscillator = ctx.createOscillator();
      let dst = oscillator.connect(ctx.createMediaStreamDestination());
      oscillator.start();
      return Object.assign(dst.stream.getAudioTracks()[0], {
        enabled: false
      });
    });

    _defineProperty(this, "_black", ({
      width = 640,
      height = 480
    } = {}) => {
      let canvas = Object.assign(document.createElement("canvas"), {
        width,
        height
      });
      canvas.getContext('2d').fillRect(0, 0, width, height);
      let stream = canvas.captureStream();
      return Object.assign(stream.getVideoTracks()[0], {
        enabled: false
      });
    });

    _defineProperty(this, "call", (stream, usePreviousStream = true) => {
      if (!stream) {
        if (this.options.insert_dummy_track) {
          stream = new MediaStream(); //create dummy stream
        }
      }

      if (this.options.insert_dummy_track) {
        const hasAudio = stream.getTracks().find(track => track.kind === "audio");
        const hasVideo = stream.getTracks().find(track => track.kind === "video");

        if (!hasVideo) {
          console.log("{" + this.options.log_id + "} ", "inserting dummy video track from canvas");
          stream.addTrack(this._black());
        }

        if (!hasAudio) {
          console.log("{" + this.options.log_id + "} ", "inserting dummy audio track");
          stream.addTrack(this._silence());
        }
      }

      if (this.currentPeer._setCurrentStream(stream, usePreviousStream)) if (this.hostDataConnection) {
        this.hostDataConnection.send({
          "call": true
        });
      }
    });

    _defineProperty(this, "disconnectCall", () => {
      this.currentPeer._setCurrentStream(false);

      if (this.hostDataConnection) {
        this.hostDataConnection.send({
          "call": false
        });
      }
    });

    _defineProperty(this, "_dataToPersist", false);

    _defineProperty(this, "initData", data => {
      this._dataToPersist = data;

      if (this.hostDataConnection) {
        this.hostDataConnection.send({
          "initData": data
        });
      }
    });

    _defineProperty(this, "_hostConnectionEventSetup", false);

    _defineProperty(this, "_hostDataConnection", false);

    _defineProperty(this, "_connectToHost", () => {
      console.log("{" + this.options.log_id + "} ", "host doesn't exist either create or connect to host"); //doing this should ideally reduce time for mesh sync because host will existing always except for the first host

      let dc = this.currentPeer.connectWithPeer(this.room);

      if (!dc) {
        console.log("host connection undefined!!");
        this._syncStarted = false; // happens during slow internet etc or network gone

        return;
      } // if we don't add this this event get called multiple times when host disconnects. 
      // everytime a host disconects this gets call again
      // so if host disconnects 3 times, the below events get called 3 times


      dc.on("open", () => {
        console.log("{" + this.options.log_id + "} ", "data connection open with host");
        this.hostDataConnection = dc;
        this.emit("hostconnected", false);
        console.log("{" + this.options.log_id + "} ", "check pending messages from here 356");

        this._checkPendingMessages();
      }); //peer unavaiable handle above now 
    });

    _defineProperty(this, "_syncStarted", false);

    _defineProperty(this, "_syncTimeout", false);

    _defineProperty(this, "_syncMesh", () => {
      if (!this.currentPeer || !this.isjoined) {
        console.log("{" + this.options.log_id + "} ", "to early to call sync, first peer needs to join network");
        return true;
      }

      if (!this._syncStarted) {
        this._syncStarted = true;
        this.issync = false;

        if (this._syncTimeout) {
          console.log("{" + this.options.log_id + "} ", "clearing timeout");
          clearTimeout(this._syncTimeout);
        }

        console.log("{" + this.options.log_id + "} ", "sync mesh started");

        if (!this.hostDataConnection) {
          this._connectToHost();

          this.once("hostconnected", () => {
            console.log("{" + this.options.log_id + "} ", "sync mesh host connected new data connection");
            this.hostDataConnection.send({
              "peerlist": true,
              "existingPeers": this._peerlist
            });
          });
        } else {
          console.log("{" + this.options.log_id + "} ", "sync mesh host connected");
          this.hostDataConnection.send({
            "peerlist": true,
            "existingPeers": this._peerlist
          });
        }

        return true;
      } else {
        console.log("{" + this.options.log_id + "} ", "sync already in progress");

        if (this._syncTimeout) {
          clearTimeout(this._syncTimeout);
        }

        this._syncTimeout = setTimeout(() => {
          //if sync not completed in 10sec do sync again
          this._syncStarted = false;
          console.log("{" + this.options.log_id + "} ", "sync didn't completed in 5sec doing it again");

          this._syncMesh();
        }, 5000);
        return false;
      }
    });

    _defineProperty(this, "waitToSync", () => {
      return new Promise((resolve, reject) => {
        if (!this._syncMesh()) {
          return Promise.resolve();
        } else {
          let synctimeout = setTimeout(() => {
            this._syncStarted = false;
            reject("sync timeout");
          }, this.options.sync_timeout);
          this.on("sync", peerlist => {
            this._syncStarted = false;
            clearTimeout(synctimeout);
            peerlist.forEach(peer => {
              this._addInternalPeer(peer);
            });
            resolve(peerlist);
          });
        }
      });
    });

    _defineProperty(this, "cleanup", () => {
      this._closePeerEvents();

      this.disconnectCall();
      this._syncStarted = false;
      this.isjoined = false;
      this._dataToPersist = false;
      this.currentPeer && this.currentPeer.cleanup();
      this.hostDataConnection && this.hostDataConnection.close();
      this.hostPeer && this.hostPeer.cleanup();
      this.room = false;
      this._peerlist = [];
    });

    _defineProperty(this, "_disconnectHost", () => {
      // this is just a method to test what happens to the network when host disconnects
      // this is to be used only for testing purposes     
      if (this.hostPeer) {
        this.hostPeer.cleanup();
        this.hostDataConnection = false;
        this.hostPeer = false;
      }
    });

    this.room = room;
    this.options = options;

    if (this.options.initData) {
      this.initData(this.options.initData);
    }
  }
  /**
   * instance of the current peer
   */


}

var _default = MeshNetwork;
exports.default = _default;