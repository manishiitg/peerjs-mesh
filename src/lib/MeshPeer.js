import Peer from "peerjs"
import { v4 as uuidv4 } from 'uuid';
const EventEmitter = require('events');

/**
 * MeshPeer classes. This handle all the logic of the peer inside a mesh
 */
class MeshPeer extends EventEmitter {
    options = {}
    constructor(options) {
        super()
        this.options = options
    }

    /**
     * if of the current peer in the peerjs network
     */
    id = false
    /**
     * room id or the id of the mesn
     */
    roomid = false

    /**
     * peerjs peer object
     */
    _peer = false


    /**
     * peerjs dataConnection map with other peers or host depending on the mesh mode
     */
    _dataConnectionMap = {}
    /**
     * peerjs media connection map with other peers or host depending on the mesh mode
     */
    _mediaConnectionMap = {}


    _connectionRetry = 0
    _nodeidx = 0


    /**
     * connect to the peerjs network
     * @param {*} room  room id or mesh id
     */
    connectNetwork = (room) => {
        this.roomid = room
        this._connectToPeerJs()
    }
    /**
     * connect to the peerjs network
     */
    _connectToPeerJs = () => {
        // let peerid = this.roomid + "-" + this._nodeidx
        let peerid = uuidv4()
        let connection = {}
        if (this.options.connection) {
            connection = this.options.connection
        }
        this._peer = new Peer(peerid, {
            debug: 1,
            ...connection
        })
        this._connectionRetry = this._connectionRetry + 1
        try {
            this._peer.on("open", () => {

                console.log("{" + this.options.log_id + "} ", "connnect to peer network with id: ", peerid)
                this.id = peerid
                this.joined()
            })
            this._peer.on("error", (err) => {
                if (err.type === "unavailable-id") {

                    if (this._nodeidx > this.options.max_mesh_peers) {
                        this.emit("error", "mesh max node reached")
                    } else {
                        this._nodeidx = this._nodeidx + 1
                        this._connectToPeerJs()
                    }

                } else {
                    if (err.type === "disconnected" || err.type === "network" || err.type === "server-error" || err.type === "socket-error" || err.type === "socket-closed") {
                        console.log("{" + this.options.log_id + "} ", "peer error", peerid, err.type, err)
                        if (this.options.retry && this._connectionRetry < this.options.retry) {
                            console.log("{" + this.options.log_id + "} ", "retrying connection ", this._connectionRetry)
                            setTimeout(() => {
                                this._connectToPeerJs(peerid)
                            }, this.options.retry_interval)
                        }
                    } else {
                        // this.emit("error", err)
                    }
                }
                //need to handle this error
                // this.emit("error", err)

            })
            this._peer.on("close", () => {
                // console.log("{" + this.options.log_id + "} ", "peer close", peerid)
                // if (this.id !== peerid)
                if (this.options.retry && this._connectionRetry < this.options.retry) {
                    console.log("{" + this.options.log_id + "} ", "retrying connection ", this._connectionRetry)
                    setTimeout(() => {
                        this._connectToPeerJs(peerid)
                    }, this.options.retry_interval)
                } else {
                    this.emit("error", "peer connection closed")
                }
            })
        } catch (error) {
            console.warn(error, " when joining peer network")
            this.emit("error", error)
        }
    }
    joined = () => {
        console.log("{" + this.options.log_id + "} ", "emit joined", this.id)
        this.emit("joined", this.id)

        this._peer.on("connection", (dc) => {
            this._listenDataConnection(dc)
        })
    }

    getPeers = () => {
        return Object.keys(this._dataConnectionMap)
    }

    _listenDataConnection = (dc) => {
        dc.on("data", (data) => {
            console.log("{" + this.options.log_id + "} ", "data recevied by", this.id, " from ", dc.peer, data, " when listing")
            if (data.healthcheck) {
                if (data.healthcheck === "ping") {
                    dc.send({ "healthcheck": "pong" })
                }
                if (data.healthcheck === "pong") {
                    if (dc.peer !== this.roomid) {
                        this._dataConnectionMap[dc.peer] = dc
                        this.emit("peer", dc.peer)
                    }
                }
            }
        })
        dc.on("open", () => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection opened with peer when listing ", dc.peer)
            if (dc.peer !== this.roomid) {
                dc.send({ "healthcheck": "ping" })
                this._dataConnectionMap[dc.peer] = dc
            }
        })
        dc.on("close", () => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection closed with peer when listing ", dc.peer)
            delete this._dataConnectionMap[dc.peer]
        })
        dc.on("error", (err) => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection err with peer when listing ", err, dc.peer)
            delete this._dataConnectionMap[dc.peer]

        })
    }

    connectWithPeer = (other_peer_id, serve = true) => {
        let dc = this._peer.connect(other_peer_id)
        if (serve)
            this._serveDataConnection(dc)
        return dc
    }

    _serveDataConnection = (dc) => {
        if (!dc) return
        dc.on("data", (data) => {
            console.log("{" + this.options.log_id + "} ", "data recevied by", this.id, " from ", dc.peer, data, " when serving")

            if (data.peerlist) {
                console.log("{" + this.options.log_id + "} ", "data.peers", data.peers)
                //  will send peer list it has 

                if (this.options.mesh_mode) {
                    // in host mode we don't need to establish data connection with other peers,
                    // just need to establish connection with the host
                    this.emit("sync", data.peers)
                } else {
                    // need to establish data connection with other peers as well
                    // in full mesh mode
                    let connectedPeers = []
                    data.peers.forEach((other_peer_id) => {
                        if (this.id !== other_peer_id) {
                            if (!this._dataConnectionMap[other_peer_id]) {
                                this.connectWithPeer(other_peer_id)
                                this.on("peer", (id) => {
                                    if (connectedPeers.indexOf(id) === -1) connectedPeers.push(id)
                                    console.log("{" + this.options.log_id + "} ", "peer added", id, data.peers.length, connectedPeers.length, connectedPeers)
                                    if (data.peers.length === connectedPeers.length) {
                                        this.emit("sync", connectedPeers)
                                    }
                                })
                                console.log("{" + this.options.log_id + "} ", "establishing new connection with ", other_peer_id)
                            } else {
                                console.log("{" + this.options.log_id + "} ", "already established data connection with ", other_peer_id)
                                if (connectedPeers.indexOf(other_peer_id) === -1) connectedPeers.push(other_peer_id)
                                if (data.peers.length === connectedPeers.length) {
                                    this.emit("sync", connectedPeers)
                                }
                            }
                        } else {
                            console.log("{" + this.options.log_id + "} ", " its me!")
                            if (connectedPeers.indexOf(other_peer_id) === -1) connectedPeers.push(other_peer_id)
                            console.log("{" + this.options.log_id + "} ", data.peers.length, connectedPeers.length, connectedPeers)
                            if (data.peers.length === connectedPeers.length) {
                                this.emit("sync", connectedPeers)
                            }
                        }
                    })
                }
            }

            if (data.healthcheck) {
                if (data.healthcheck === "ping") {
                    dc.send({ "healthcheck": "pong" })
                }
                if (data.healthcheck === "pong") {
                    if (dc.peer !== this.roomid) {
                        this._dataConnectionMap[dc.peer] = dc
                        this.emit("peer", dc.peer)
                    }
                }
            }
            if (data.message) {
                this.emit("data", data.message)
            }
            if (data.identify) {
                this.emit("peerjoined", data.identify)
            }
            if (data.dropped) {
                this.emit("peerdropped", data.dropped)
            }
            if (data.hostdropped) {
                this.emit("hostdropped")
            }
        })
        dc.on("open", () => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection opened with peer when serving ", dc.peer)
            if (dc.peer !== this.roomid) {
                dc.send({ "healthcheck": "ping" })
                this._dataConnectionMap[dc.peer] = dc
            }
        })
        dc.on("close", () => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection closed with peer when serving", dc.peer)
            delete this._dataConnectionMap[dc.peer]
            if (dc.peer === this.id) {
            } else {
                if (dc.peer === this.roomid) {
                    this.emit("hostdropped")
                } else {
                    this.emit("peerdropped", dc.peer)
                }
            }

        })
        dc.on("error", (err) => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection err with peer", err, dc.peer)
            delete this._dataConnectionMap[dc.peer]
            if (dc.peer === this.id) {
            } else {
                if (dc.peer === this.roomid) {
                    this.emit("hostdropped")
                } else {
                    this.emit("peerdropped", dc.peer)
                }
            }
        })
    }



    sendData = (peerid, data) => {
        if (this._dataConnectionMap[peerid]) {
            this._dataConnectionMap[peerid].send(data)
        }
    }

    // queryPeerList = () => {

    //     new QueryMesh(this.options).query(this._peer, this.roomid, this._nodeidx, (dc) => {
    //         if (dc) {
    //             console.log("{" + this.options.log_id + "} ", "found a peer with id", dc.peer)
    //             this._dataConnectionMap[dc.peer] = dc
    //         } else {
    //             this.emit("error", "unable to find a peer")
    //         }
    //     }, false)
    // }

    cleanup = () => {
        console.log("{" + this.options.log_id + "} ", "destroy peer")
        console.log(this._peer)
        Object.keys(this._dataConnectionMap).forEach(key => {
            this._dataConnectionMap[key].close()
        })
        this._peer && this._peer.destroy()
        this.roomid = false
    }


    _log = (msg, ...args) => {
        console.log("{" + this.options.log_id + "} " + msg, ...args)
    }
}

export default MeshPeer