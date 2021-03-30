import Peer from "peerjs"
const EventEmitter = require('events');
export default class MeshHost extends EventEmitter {
    options = {}
    constructor(options) {
        super()
        this.options = { ...options, "log_id": `host-` + options.log_id }
    }
    roomid = false
    _peer = false
    _dataConnectionMap = {}

    connectNetwork = (room) => {
        this.roomid = room
        this._connectToPeerJs()
    }
    _connectToPeerJs = () => {
        let peerid = this.roomid
        try {

            let connection = {}
            if (this.options.connection) {
                connection = this.options.connection
            }
            this._peer = new Peer(peerid, {
                debug: 1,
                ...connection
            })
            this._connectionRetry = this._connectionRetry + 1
            this._peer.on("open", () => {

                console.log("{" + this.options.log_id + "} ", "host connnect to peer network with id: ", peerid)
                this.id = peerid
                this.emit("created", this._peer)

            })
            this._peer.on("error", (err) => {
                if (err.type === "unavailable-id") {
                    this.emit("exists")
                } else {
                    if (err.type === "disconnected" || err.type === "network" || err.type === "server-error" || err.type === "socket-error" || err.type === "socket-closed") {
                        console.log("{" + this.options.log_id + "} ", "peer error", peerid, err.type, err)
                        if (this.options.retry && this._connectionRetry < this.options.retry) {
                            console.log("{" + this.options.log_id + "} ", "retrying connection ", this._connectionRetry)
                            setTimeout(() => {
                                this._connectToPeerJs(peerid)
                            }, this.options.retry_interval)
                        } else {
                            Object.keys(this._dataConnectionMap).forEach(key => {
                                this._dataConnectionMap[key].send({
                                    "hostconnection-error": true
                                })
                            })
                        }
                    } else {
                        this.emit("exists")
                    }
                }

            })
            this._peer.on("close", () => {
                Object.keys(this._dataConnectionMap).forEach(key => {
                    this._dataConnectionMap[key].send({
                        "hostdropped": true
                    })
                })
            })

            this._peer.on("connection", (dc) => {
                this._listenDataConnection(dc)
            })

        } catch (error) {
            console.warn(error)
        }
    }

    _pendingMessages = {}

    _listenDataConnection = (dc) => {
        dc.on("data", (data) => {
            console.log("{" + this.options.log_id + "} ", "data recevied by", this.id, " from ", dc.peer, data, " when listing")
            if (data.peerlist) {

                //peermesh doesn't have a peer list
                //mesh network has it
                // but peer mesh _dataConnection map lets use it 
                // but then we should not maintain a duplicate peer list in mesh network

                dc.send({
                    "peerlist": true,
                    "peers": Object.keys(this._dataConnectionMap),
                    "existingPeers": data.existingPeers
                })
            }
            if (data.ispending) {
                console.log("{" + this.options.log_id + "} ", " this is an old data which was not sent due to host going down")
                let peerlist = data.peerlist
                console.log("==================", peerlist, data)
                peerlist.forEach((pendingpeerid) => {
                    console.log("==================", pendingpeerid)
                    if (!this._pendingMessages[pendingpeerid]) {
                        this._pendingMessages[pendingpeerid] = {}
                    }
                    this._pendingMessages[pendingpeerid][data["unique"]] = data["data"]
                    console.log("====================== this._pendingMessages[pendingpeerid]", this._pendingMessages[pendingpeerid])
                })
                console.log("=================================")
                console.log(this._pendingMessages)


            }
            if (data.message) {
                Object.keys(this._dataConnectionMap).forEach(key => {
                    this._dataConnectionMap[key].send({
                        "message": data.message
                    })
                })
                dc.send({ "message_reciept": data.id })
            }

        })
        dc.on("open", () => {
            if (this._pendingMessages) {
                if (this._pendingMessages[dc.peer]) {
                    console.log("=================================", this._pendingMessages[dc.peer])
                    console.log("{" + this.options.log_id + "} ", this.id, "pending messages exists for ", dc.peer)
                    let unique_keys = Object.keys(this._pendingMessages[dc.peer])
                    unique_keys.forEach(key => {
                        this._pendingMessages[dc.peer][key] && dc.send({
                            "message": this._pendingMessages[dc.peer][key]
                        })
                        this._pendingMessages[dc.peer][key] = false
                    })

                }
            }
            console.log("{" + this.options.log_id + "} ", this.id, "data connection opened with peer when listing ", dc.peer)
            Object.keys(this._dataConnectionMap).forEach(key => {
                this._dataConnectionMap[key].send({
                    "identify": dc.peer
                })
            })

            this._dataConnectionMap[dc.peer] = dc


        })
        dc.on("close", () => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection closed with peer when listing ", dc.peer)
            delete this._dataConnectionMap[dc.peer]
            Object.keys(this._dataConnectionMap).forEach(key => {
                this._dataConnectionMap[key].send({
                    "dropped": dc.peer
                })
            })

        })
        dc.on("error", (err) => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection err with peer when listing ", err, dc.peer)
            delete this._dataConnectionMap[dc.peer]
            Object.keys(this._dataConnectionMap).forEach(key => {
                this._dataConnectionMap[key].send({
                    "dropped": dc.peer
                })
            })

        })
    }

    cleanup = () => {
        console.log("{" + this.options.log_id + "} ", "host destroy peer")
        this._dataConnectionMap = {}
        this._peer && this._peer.destroy()
    }
}