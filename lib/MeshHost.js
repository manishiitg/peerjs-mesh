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
    _mediaConnectionMap = {} //not used
    _callMap = {} //list of peer who have started their stream

    connectNetwork = (room) => {
        this.roomid = room
        this._connectToPeerJs()
    }
    _listenOpen = () => {
        console.log("{" + this.options.log_id + "} ", "host connnect to peer network with id: ", this.peerid)
        this.id = this.peerid
        this.emit("created", this._peer)

    }

    _listenError = (err) => {
        console.log("{" + this.options.log_id + "} ", "error", err)
        if (err.type === "unavailable-id") {
            this.emit("exists")
        } else {
            if (err.type === "disconnected" || err.type === "network" || err.type === "server-error" || err.type === "socket-error" || err.type === "socket-closed") {
                console.log("{" + this.options.log_id + "} ", "peer error", this.peerid, err.type, err)
                if (this.options.retry && this._connectionRetry < this.options.retry) {
                    console.log("{" + this.options.log_id + "} ", "retrying connection ", this._connectionRetry)
                    setTimeout(() => {
                        this._connectToPeerJs(this.peerid)
                    }, this.options.retry_interval)
                } else {
                    // Object.keys(this._dataConnectionMap).forEach(key => {
                    //     this._dataConnectionMap[key].send({
                    //         "hostconnection-error": true
                    //     })
                    // })
                    this.emit("error", err)
                }
            } else {
                this.emit("exists")
            }
        }
    }
    _listenClose = () => {
        Object.keys(this._dataConnectionMap).forEach(key => {
            this._dataConnectionMap[key].send({
                "hostdropped": true
            })
        })
    }
    _listenDataConnection = (dc) => {
        this._listenDataConnection(dc)
    }
    _connectToPeerJs = () => {
        this.peerid = this.roomid
        try {

            let connection = {}
            if (this.options.connection) {
                connection = this.options.connection
            }
            this._peer = new Peer(this.peerid, {
                debug: 1,
                ...connection
            })
            this._connectionRetry = this._connectionRetry + 1
            this._peer.on("open", this._listenOpen)
            this._peer.on("error", this._listenError)
            this._peer.on("close", this._listenClose)
            this._peer.on("connection", this._listenDataConnection)

        } catch (error) {
            console.warn(error)
        }
    }

    _pendingMessages = {}
    _initData = {}

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
                    "existingPeers": data.existingPeers,
                    "callMap": this._callMap
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
                    if (key !== dc.peer) //dont send data to the same host
                        this._dataConnectionMap[key].send({
                            "message": data.message
                        })
                })
                dc.send({ "message_reciept": data.id })
            }
            if (data.initData && Object.keys(data.initData).length > 0) {
                this._initData[dc.peer] = data.initData
                Object.keys(this._dataConnectionMap).forEach(key => {
                    if (key !== dc.peer) //dont send data to the same host
                        this._dataConnectionMap[key].send({
                            "initData": this._initData
                        })
                })
            }
            if ("call" in data) {
                if (!data.call) {
                    Object.keys(this._dataConnectionMap).forEach(key => {
                        if (key !== dc.peer) //dont send data to the same host
                            this._dataConnectionMap[key].send({
                                "callstopped": dc.peer
                            })
                    })
                    delete this._callMap[dc.peer]
                } else {
                    dc.send({ "callMap": this._callMap })
                    this._callMap[dc.peer] = true
                }
            }

        })
        dc.on("open", () => {
            if (this._pendingMessages) {
                if (this._pendingMessages[dc.peer]) {
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
            if (this._initData) {
                dc.send({ "initData": this._initData })
            }

            console.log("{" + this.options.log_id + "} ", this.id, "data connection opened with peer when listing ", dc.peer)
            console.log("{" + this.options.log_id + "} ", this.id, "current mesh limit ", this.options.mesh_limit, " and mesh size", Object.keys(this._dataConnectionMap).length)


            if (this.options.mesh_limit === -1) {
                Object.keys(this._dataConnectionMap).forEach(key => {
                    this._dataConnectionMap[key].send({
                        "identify": dc.peer
                    })
                })
                this._dataConnectionMap[dc.peer] = dc
            } else {

                if (Object.keys(this._dataConnectionMap).length < this.options.mesh_limit) {
                    Object.keys(this._dataConnectionMap).forEach(key => {
                        this._dataConnectionMap[key].send({
                            "identify": dc.peer
                        })
                    })
                    this._dataConnectionMap[dc.peer] = dc
                } else {
                    dc.send({ "meshlimit": this.options.mesh_limit })
                    // dc.close() 
                    // if we close it here we are not able to inform the peer about it 
                }

            }





        })
        dc.on("close", () => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection closed with peer when listing ", dc.peer)
            delete this._dataConnectionMap[dc.peer]
            delete this._callMap[dc.peer]
            Object.keys(this._dataConnectionMap).forEach(key => {
                this._dataConnectionMap[key].send({
                    "dropped": dc.peer
                })
            })

        })
        dc.on("error", (err) => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection err with peer when listing ", err, dc.peer)
            delete this._dataConnectionMap[dc.peer]
            delete this._callMap[dc.peer]
            Object.keys(this._dataConnectionMap).forEach(key => {
                this._dataConnectionMap[key].send({
                    "dropped": dc.peer
                })
            })

        })
    }

    cleanup = () => {
        console.log("{" + this.options.log_id + "} ", "host destroy peer")
        Object.keys(this._dataConnectionMap).forEach(key => {
            this._dataConnectionMap[key].close()
        })

        this._peer.off("open", this._listenOpen)
        this._peer.off("error", this._listenError)
        this._peer.off("close", this._listenClose)
        this._peer.off("connection", this._listenDataConnection)
        this._dataConnectionMap = {}
        this._callMap = {}
        this._peer.destroy()
    }
}