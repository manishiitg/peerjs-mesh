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
    _dataConnectionPingMap = {}
    _dataConnectionMap = {}
    _mediaConnectionMap = {} //not used
    _callMap = {} //list of peer who have started their stream

    _isOwner = false
    setOwnerId = (id) => {
        this._isOwner = id
    }
    connectNetwork = (room) => {
        this.roomid = room
        this._connectToPeerJs()
        console.log("this.options.do_health_check", this.options.do_health_check)
        this.options.do_health_check && this._healthCheckPeers()
    }

    _healtCheckInterval = false
    _healthCheckPeers = () => {
        let checkInterval = this.options.do_health_check_interval
        this._healtCheckInterval = setInterval(() => {
            Object.keys(this._dataConnectionMap).forEach(key => {
                console.log("{" + this.options.log_id + "} host health check connection open:", this._dataConnectionMap[key].open, " connection reliable: ", this._dataConnectionMap[key].reliable)
                this._dataConnectionMap[key].send({ "healthcheck": "ping" })
                if (this._dataConnectionPingMap[key]) {
                    let timePassed = (new Date().getTime() - this._dataConnectionPingMap[key])
                    if (timePassed > checkInterval * 3) {
                        // this is some issue data connection has dropped it seems
                        this._peerDropped(key)
                    }

                }
            })
        }, checkInterval)
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
                    if (this.id) {
                        //error came after peer was connected might be internet issue etc
                        console.log("call dropped at host due to network issues, connecting again")
                        setTimeout(() => {
                            this._connectToPeerJs(this.peerid)
                        }, this.options.retry_interval)
                    } else {
                        console.log("{" + this.options.log_id + "} ", "retrying connection ", this._connectionRetry)
                        setTimeout(() => {
                            this._connectToPeerJs(this.peerid)
                        }, this.options.retry_interval)
                    }
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
                console.log("using connection", connection)
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

    _peerDropped = (id) => {
        delete this._dataConnectionMap[id]
        delete this._callMap[id]
        Object.keys(this._dataConnectionMap).forEach(key => {
            this._dataConnectionMap[key].send({
                "dropped": id
            })
        })
    }

    _pendingMessages = {}
    _initData = {}

    _hostOwnerInterval = false

    _listenDataConnection = (dc) => {
        //if owner mode need to first wait for host and owner to start a connection first else things are going to break. this is a race condition
        // a normal peer can connect first
        // if (this.options.owner_mode) {
        //     //this looks very risky to me....
        //     //think of something better..
        //     if (!this._dataConnectionMap[this._isOwner]) {
        //         if (dc.peer !== this._isOwner) {
        //             await new Promise((resolve) => {
        //                 this._hostOwnerInterval = setInterval(() => {
        //                     console.log("waiting for host owner to establish connection....", this._isOwner)
        //                     if (this._dataConnectionMap[this._isOwner]) {
        //                         resolve()
        //                     }
        //                 }, 20)
        //             })
        //             clearInterval(this._hostOwnerInterval)

        //         }
        //     }
        // }
        dc.on("data", async (data) => {

            if (data.healthcheck && data.healthcheck === "pong") {
                this._dataConnectionPingMap[dc.peer] = new Date().getTime()
                return //return just to skip console
            }
            console.log("{" + this.options.log_id + "} ", "data recevied by", this.id, " from ", dc.peer, data, " when listing")
            if (data.peerlist) {

                if (this.options.owner_mode) {
                    if (!this.options.is_owner) {
                        throw new Error("this is unexpected, in owner mode only host should be owner need to debug!")
                    } else {
                        const callMapOwnerKey = this._callMap[this._isOwner] ? this._callMap[this._isOwner] : false
                        let newCallMap = {}
                        newCallMap[this._isOwner] = callMapOwnerKey
                        dc.send({
                            "peerlist": true,
                            "peers": Object.keys(this._dataConnectionMap).filter(key => this._isOwner === key),
                            "existingPeers": data.existingPeers,
                            "callMap": newCallMap
                        })
                    }
                } else {
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
                if (this.options.owner_mode) {
                    if (this._isOwner === dc.peer) {
                        //owner is sending msgs

                        if (data.to_peer) {
                            this._dataConnectionMap[data.to_peer] && this._dataConnectionMap[data.to_peer].send({
                                "message": data.message,
                                "from_peer": dc.peer
                            })
                        } else {
                            Object.keys(this._dataConnectionMap).forEach(key => {
                                if (key !== dc.peer) //dont send data to the same host
                                    this._dataConnectionMap[key].send({
                                        "message": data.message,
                                        "from_peer": dc.peer
                                    })
                            })
                        }
                    } else {
                        this._dataConnectionMap[this._isOwner].send({
                            "message": data.message,
                            "from_peer": dc.peer
                        })
                    }
                } else {
                    if (data.to_peer) {
                        this._dataConnectionMap[data.to_peer] && this._dataConnectionMap[data.to_peer].send({
                            "message": data.message,
                            "from_peer": dc.peer
                        })
                    } else {
                        Object.keys(this._dataConnectionMap).forEach(key => {
                            if (key !== dc.peer) //dont send data to the same host
                                this._dataConnectionMap[key].send({
                                    "message": data.message,
                                    "from_peer": dc.peer
                                })
                        })
                    }
                }
                dc.send({ "message_reciept": data.id })
            }
            if (data.initData && Object.keys(data.initData).length > 0) {
                this._initData[dc.peer] = data.initData
                if (this.options.owner_mode) {
                    if (dc.peer == this._isOwner) {
                        Object.keys(this._dataConnectionMap).forEach(key => {
                            if (this._isOwner !== dc.peer) //dont send data to the same host
                                this._dataConnectionMap[key].send({
                                    "initData": this._initData
                                })
                        })
                    } else {
                        this._dataConnectionMap[this._isOwner] && this._dataConnectionMap[this._isOwner].send({
                            "initData": this._initData
                        })
                    }
                } else {
                    Object.keys(this._dataConnectionMap).forEach(key => {
                        if (key !== dc.peer) //dont send data to the same host
                            this._dataConnectionMap[key].send({
                                "initData": this._initData
                            })
                    })
                }
            }
            if ("call" in data) {
                if (!data.call) {
                    if (this.options.owner_mode) {
                        this._dataConnectionMap[this._isOwner].send({
                            "callstopped": dc.peer
                        })
                    } else {
                        Object.keys(this._dataConnectionMap).forEach(key => {
                            if (key !== dc.peer) //dont send data to the same host
                                this._dataConnectionMap[key].send({
                                    "callstopped": dc.peer
                                })
                        })
                    }
                    delete this._callMap[dc.peer]
                } else {
                    let callMap = Object.assign({}, this._callMap)
                    if (callMap[dc.peer])
                        delete callMap[dc.peer]

                    if (this.options.owner_mode) {

                        if (this._isOwner === dc.peer) {
                            dc.send({ "callMap": callMap })
                        } else {
                            const callMapOwnerKey = this._callMap[this._isOwner] ? this._callMap[this._isOwner] : false
                            let newCallMap = {}
                            newCallMap[this._isOwner] = callMapOwnerKey
                            dc.send({
                                "callMap": newCallMap
                            })
                        }
                    } else {
                        dc.send({ "callMap": callMap })
                    }

                    this._callMap[dc.peer] = true
                }
            }

        })
        dc.on("open", async () => {

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
                if (this.options.owner_mode) {

                    let owner_init_data = {}
                    if (owner_init_data[this._isOwner])
                        owner_init_data[this._isOwner] = this._initData[this._isOwner]

                    dc.send({
                        "initData": owner_init_data
                    })
                } else {
                    dc.send({ "initData": this._initData })
                }
            }

            console.log("{" + this.options.log_id + "} ", this.id, "data connection opened with peer when listing ", dc.peer)
            console.log("{" + this.options.log_id + "} ", this.id, "current mesh limit ", this.options.mesh_limit, " and mesh size", Object.keys(this._dataConnectionMap).length)


            if (this.options.mesh_limit === -1) {
                if (this.options.owner_mode) {
                    if (this._isOwner !== dc.peer)
                        this._dataConnectionMap[this._isOwner] && this._dataConnectionMap[this._isOwner].send({
                            "identify": dc.peer
                        })
                } else {
                    Object.keys(this._dataConnectionMap).forEach(key => {
                        this._dataConnectionMap[key].send({
                            "identify": dc.peer
                        })
                    })
                }
                this._dataConnectionMap[dc.peer] = dc

            } else {

                if (Object.keys(this._dataConnectionMap).length < this.options.mesh_limit) {
                    if (this.options.owner_mode) {
                        console.log("this._isOwner !== dc.peer", this._isOwner, dc.peer, this._dataConnectionMap)
                        if (this._isOwner !== dc.peer)
                            this._dataConnectionMap[this._isOwner] && this._dataConnectionMap[this._isOwner].send({
                                "identify": dc.peer
                            })
                    } else {
                        Object.keys(this._dataConnectionMap).forEach(key => {
                            this._dataConnectionMap[key].send({
                                "identify": dc.peer
                            })
                        })
                    }
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
            this._peerDropped(dc.peer)

        })
        dc.on("error", (err) => {
            console.log("{" + this.options.log_id + "} ", this.id, "data connection err with peer when listing ", err, dc.peer)
            this._peerDropped(dc.peer)

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
        this._healtCheckInterval && clearInterval(this._healtCheckInterval)
        this._peer.destroy()
        this._isOwner = false

    }
}