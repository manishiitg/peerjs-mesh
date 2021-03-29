import MeshHost from "./MeshHost";
import MeshPeer from "./MeshPeer";
const EventEmitter = require('events');

class MeshNetwork extends EventEmitter {
    options = {}
    constructor(room, options) {
        super()
        this.room = room
        if (!options.log_id) {
            options.log_id = Math.floor(Math.random() * 100)
        }
        if (!options.retry) {
            options.retry = 5
        }
        if (!options.retry_interval) {
            options.retry_interval = 1 * 1000
        }
        if (!options.join_timeout) {
            options.join_timeout = 10 * 1000
        }
        if (!options.sync_timeout) {
            options.sync_timeout = 60 * 1000
        }
        if (!options.max_mesh_peers) {
            options.max_mesh_peers = 10
        }

        if (!options.mesh_mode) {
            options.mesh_mode = "host"
            // in host mode, there is always on host
            // and host is responsible for communication with all peers
        }
        this.options = options
    }

    currentPeer = false
    isjoined = false
    id = false
    hostPeer = false
    hostDataConnection = false
    _peerlist = []

    addPeer = () => {
        this.currentPeer = new MeshPeer(this.options)
        this.currentPeer.connectNetwork(this.room)
        this.currentPeer.on("joined", (id) => {
            this.id = id
            this.emit("joined", id)
            this.isjoined = true
            this._syncMesh()

        })
        this.currentPeer.on("left", (id, err) => {
            this.isjoined = false
        })
        this.currentPeer.on("peerjoined", (peerid) => {
            console.log("{" + this.options.log_id + "} ", "new peer added to mesh", peerid)
            if (this._peerlist.indexOf(peerid) !== 0) this._peerlist.push(peerid)
            this.emit("peerjoined", peerid)
        })
        this.currentPeer.on("peerdropped", (id) => {
            this.emit("peerdropped", id)
            if (this._peerlist.indexOf(id) >= 0) this._peerlist = this._peerlist.filter(p => p !== id)
        })
        this.currentPeer.on("sync", (connectedPeers) => {
            console.log("{" + this.options.log_id + "} ", "sync completed", connectedPeers)
            this.emit("sync", connectedPeers)
            this._syncStarted = false
        })
        this.currentPeer.on("error", (err) => {
            this.emit("error", err)
        })
        this.currentPeer.on("data", data => this.emit("data", data))
        this.currentPeer.on("hostdropped", () => {
            console.log("{" + this.options.log_id + "} ", "host has dropped this is a major issue need to create a new host")
            this.hostPeer = false
            this.hostDataConnection = false
            this._syncMesh()
        })
    }
    isJoined = () => {
        return this.isjoined
    }
    waitToJoin = () => {
        if (this.isjoined) {
            return Promise.resolve(true)
        } else {

            return new Promise((resolve, reject) => {
                let timeout = setTimeout(() => {
                    reject("timeout")
                }, this.options.join_timeout)
                this.on("joined", () => {
                    clearTimeout(timeout)
                    resolve()
                })

            })
        }
    }

    getPeers = () => {
        return this.currentPeer.getPeers()
    }

    //send data using data channel
    send = (data) => {
        if (this.options.mesh_mode === "host") {
            if (this.hostDataConnection) {
                this.hostDataConnection.send({
                    "message": data
                })
            } else {
                console.log("owner data connection is required before sending data, wait for network sync")
            }
        } else {
            this.getPeers().forEach((id) => {
                this.currentPeer.sendData(id, data)
            })
        }
    }

    _connectToHost = (cb) => {
        console.log("{" + this.options.log_id + "} ", "owner doesn't exist")
        let host = new MeshHost(this.options)
        host.connectNetwork(this.room)
        let dc = false
        host.on("created", (peer) => {
            console.log("{" + this.options.log_id + "} ", " host created ", peer)
            this.hostPeer = host
            dc = this.currentPeer.connectWithPeer(this.room)
            dc.on("open", () => {
                console.log("{" + this.options.log_id + "} ", "data connection opened with owner")
                this.hostDataConnection = dc
                cb()
            })
        })
        host.on("exists", () => {
            console.log("{" + this.options.log_id + "} ", " host exists ")
            dc = this.currentPeer.connectWithPeer(this.room)
            dc.on("open", () => {
                console.log("{" + this.options.log_id + "} ", "data connection opened with owner")
                this.hostDataConnection = dc
                cb()
            })
        })
    }
    _syncStarted = false
    _syncMesh = () => {
        if (!this.currentPeer || !this.isjoined) {
            console.log("{" + this.options.log_id + "} ", "to early to call sync, first peer needs to join network")
            return true
        }
        if (!this._syncStarted) {
            this._syncStarted = true
            console.log("{" + this.options.log_id + "} ", "sync mesh")
            if (!this.hostDataConnection) {
                this._connectToHost(() => {
                    this.hostDataConnection.send({ "peerlist": true, "existingPeers": this._peerlist })
                })
            } else {
                this.hostDataConnection.send({ "peerlist": true, "existingPeers": this._peerlist })
            }
            return true
        } else {
            console.log("{" + this.options.log_id + "} ", "sync already in progress")
            return false
        }

    }

    waitToSync = () => {
        return new Promise((resolve, reject) => {
            if (!this._syncMesh()) {
                return Promise.resolve()
            } else {
                let synctimeout = setTimeout(() => {
                    this._syncStarted = false
                    reject("sync timeout")
                }, this.options.sync_timeout)
                this.on("sync", (peerlist) => {
                    this._syncStarted = false
                    clearTimeout(synctimeout)
                    resolve(peerlist)
                })
            }
        })
    }

    cleanup = () => {
        this.isjoined = false
        this.currentPeer && this.currentPeer.cleanup()
        this.hostDataConnection && this.hostDataConnection.close()
        this.hostPeer && this.hostPeer.cleanup()
        this.currentPeer = false
        this.room = false
    }
    _disconnectHost = () => {
        // this is just a method to test what happens to the network when host disconnects
        // this is to be used only for testing purposes     
        if (this.hostPeer) {
            this.hostPeer.cleanup()
            this.hostDataConnection = false
            this.hostPeer = false
        }
    }
}

export default MeshNetwork