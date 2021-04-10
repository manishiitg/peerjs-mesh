import MeshHost from "./MeshHost";
import MeshPeer from "./MeshPeer";
import { v4 as uuidv4 } from 'uuid';
const EventEmitter = require('events');

/**
 * Mesh Network class is responsible for managing the peers inside a mesh and also the host
 * It will manage the different type of mesh modes i.e host/full mesh
 * A client application will only interact with the MeshNetwork class
 */
class MeshNetwork extends EventEmitter {
    options = {}
    constructor(room, options) {
        super()
        this.room = room
        this.options = options
        if (this.options.initData) {
            this.initData(this.options.initData)
        }
    }

    /**
     * instance of the current peer
     */
    currentPeer = false

    /**
     * is joined to the peerjs network
     */
    isjoined = false

    /**
     * sync completed
     */
    issync = false

    /**
     * unique id of this peer
     */
    id = false

    /**
     * instance of the host peer
     * will be false if host peer already exists and only data connection is opened
     */
    hostPeer = false
    /**
     * data connection opened with the host peer
     */
    hostDataConnection = false
    /**
     * list of peers current in this mesh
     */
    _peerlist = []

    /**
     * Adding a peer to mesh network
     * This creates new MeshPeer object
     * The new MeshPeer will then connect to the peerjs networking
     * Once the meshpeer connects to the peerjs network sucessfully
     *  a) We set the id of the mesh network same as the peer id
     *  b) join event is emitted
     *  c) isjoined is set as true
     *  d) we start to sync the mesh
     */
    addPeer = () => {
        this.currentPeer = new MeshPeer(this.options)
        this.currentPeer.connectNetwork(this.room)
        let joinTimeout = false
        if (this.options.join_timeout !== -1) {
            joinTimeout = setTimeout(() => {
                this.isjoined = false
                this.emit("error", "Peer timed out before joining network")
                this.cleanup() //if we don't clean peer still tries to connect to network
            }, this.options.join_timeout)
        }
        this.currentPeer.on("joined", (id) => {
            joinTimeout && clearTimeout(joinTimeout)
            if (this.currentPeer) {
                this.id = id
                this.emit("joined", id)
                this.isjoined = true
                this._listenPeerEvents()
                this._syncMesh()
            } else {
                console.error("{" + this.options.log_id + "} ", "this is unexpected as this means cleanup was called before joined but event still fired")
                this.emit("error", "this is unexpected as this means cleanup was called before joined but event still fired")
            }
        })
        this.currentPeer.on("left", (id, err) => {
            this.isjoined = false
            console.warn("{" + this.options.log_id + "} ", "error in mesh network", err)
            this.emit("error", err)
        })
    }
    _addInternalPeer = (id) => {
        if (this._peerlist.indexOf(id) === -1) {
            this._peerlist.push(id)
            this.emit("peerjoined", id, this._peerlist)
        }
    }
    _removeInternalPeer = (id) => {
        if (this._peerlist.indexOf(id) >= 0) {
            this._peerlist = this._peerlist.filter(p => p !== id)
            this.emit("peerdropped", id, this._peerlist)
        }
    }
    /**
     * handle peer joined event on the mesh network
     * @param {*} id peer id of the joined peer
     */
    _listenPeerJoined = (id) => {
        console.log("{" + this.options.log_id + "} ", "new peer added to mesh", id)
        this._addInternalPeer(id)
    }
    /**
     * handle peer dropped from the mesh
     * @param {*} id peer id 
     */
    _listenPeerDropped = (id) => {
        this._removeInternalPeer(id)
    }
    /**
     * handle peer sync completed 
     * @param {*} connectedPeers list of all peers in the network
     */
    _listenSync = (connectedPeers) => {
        console.log("{" + this.options.log_id + "} ", "sync completed", connectedPeers)
        this.issync = true
        this.emit("sync", connectedPeers)
        this._peerlist = [] // when a host drops a new host is created and we get all connectedPeers from that
        connectedPeers.forEach(peer => {
            this._addInternalPeer(peer)
        })
        this._syncStarted = false
    }
    /**
     * handle error
     * @param {*} err 
     */
    _listenError = (err) => {
        if (err.type && err.type === "peer-unavailable") {
            if (err.toString().indexOf(this.room)) {
                //if error is related to host not avaiable there is no need to emit it
                return
            }
        }
        this.emit("error", err)
    }
    /**
     * listen to host getting dropped from the mesh and handle it 
     */
    _listenHostDropped = () => {
        console.log("{" + this.options.log_id + "} ", "host has dropped this is a major issue need to create a new host")
        this.hostPeer = null
        this.hostDataConnection = null
        this.emit("sync", false)
        this._syncMesh()
    }
    /**
     * listen for data recieved in the mesh
     * @param {*} data 
     * @returns 
     */
    _listenData = data => this.emit("data", data)

    _listenStream = (stream, id) => this.emit("stream", stream, id)

    _listenStreamDrop = (id) => this.emit("streamdrop", id)

    _listenInitData = (id, data) => this.emit("initData", id, data)

    _listenMeshLimitExceeded = (limit) => {
        this.emit("meshlimitexceeded", limit)
        this.cleanup()
    }

    /**
     * listen all peer events
     */
    _listenPeerEvents = () => {
        this.currentPeer.on("peerjoined", this._listenPeerJoined)
        this.currentPeer.on("peerdropped", this._listenPeerDropped)
        this.currentPeer.on("sync", this._listenSync)
        this.currentPeer.on("error", this._listenError)
        this.currentPeer.on("data", this._listenData)
        this.currentPeer.on("hostdropped", this._listenHostDropped)
        this.currentPeer.on("stream", this._listenStream)
        this.currentPeer.on("streamdrop", this._listenStreamDrop)
        this.currentPeer.on("initData", this._listenInitData)
        this.currentPeer.on("meshlimitexceeded", this._listenMeshLimitExceeded)

        this.currentPeer.on("error-peer-unavailable", (err) => {
            let host = new MeshHost(this.options)
            host.connectNetwork(this.room)
            host.on("created", (peer) => {
                console.log("{" + this.options.log_id + "} ", " host created ", peer)
                this.hostPeer = host
                let dc = this.currentPeer.connectWithPeer(this.room)
                dc.on("open", () => {
                    console.log("{" + this.options.log_id + "} ", "data connection opened with host")
                    this.hostDataConnection = dc
                    this.emit("hostconnected", true)
                    console.log("{" + this.options.log_id + "} ", "check pending messages from here 368")
                    this._checkPendingMessages()
                })
            })
            host.on("exists", () => {
                console.log("{" + this.options.log_id + "} ", " host exists ")
                let dc = this.currentPeer.connectWithPeer(this.room)
                dc.on("open", () => {
                    console.log("{" + this.options.log_id + "} ", "data connection opened with host")
                    this.hostDataConnection = dc
                    this.emit("hostconnected", false)
                    console.log("{" + this.options.log_id + "} ", "check pending messages from here 379")
                    this._checkPendingMessages()
                })
            })

        })
    }
    /**
     * stop listing to all peer events to be used for cleanup
     */
    _closePeerEvents = () => {
        if (!this.currentPeer) return
        this.currentPeer.off("peerjoined", this._listenPeerJoined)
        this.currentPeer.off("peerdropped", this._listenPeerDropped)
        this.currentPeer.off("sync", this._listenSync)
        this.currentPeer.off("error", this._listenError)
        this.currentPeer.off("data", this._listenData)
        this.currentPeer.off("hostdropped", this._listenHostDropped)
        this.currentPeer.off("stream", this._listenStream)
        this.currentPeer.off("streamdrop", this._listenStreamDrop)
        this.currentPeer.off("initData", this._listenInitData)
        this.currentPeer.off("meshlimitexceeded", this._listenMeshLimitExceeded)
    }

    /**
     * simple function to peer has joined the network
     * @returns 
     */
    isJoined = () => this.isjoined

    /**
     * wait for peer to join the network
     * this should be not used instead use waitToSync
     * @returns Promise which resolves when host joins the mesh or timesout
     */
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

    /**
     * return list of peers connected to this peer (should be same as all peers in the mesh)
     */
    getPeers = () => {
        if (this.options.mesh_mode === "host") {
            return this._peerlist
        } else {
            return this.currentPeer.getPeers()
        }
    }

    /**
     * temporary arary to store messages to send.
     * only need when host gets removed and new host is elected, in between that time
     */
    _messageToSend = []

    _checkPendingMessages = () => {
        if (this.options.mesh_mode === "host") {
            if (this._messageToSend.length > 0) {
                console.log("{" + this.options.log_id + "} ", "this._messageToSend.length", this._messageToSend.length)
                this._messageToSend.forEach((data) => {
                    this.hostDataConnection.send({
                        ...data,
                        "ispending": true,
                        "peerid": this.id,
                        "unique": uuidv4()
                    })
                })
                this._messageToSend = []
            }
        }
        if (this.currentPeer._getCurrentStream()) {
            this.call(this.currentPeer._getCurrentStream())
        }
        if (this._dataToPersist) {
            this.initData(this._dataToPersist)
        }
    }

    /**
     * send data to all peers in the mesh
     * @param {*} data data object to be sent
     */
    send = (data) => {
        if (!this.isjoined || this.sync) {
            if (this._peerlist.length > 0)
                this._messageToSend.push({
                    "data": data,
                    "peerlist": this._peerlist
                })
            console.log("{" + this.options.log_id + "} ", "Can send data only once peer has synced with the network")
            return
        }
        if (this.options.mesh_mode === "host") {
            console.log("{" + this.options.log_id + "} ", 'this.hostDataConnection', this.hostDataConnection)
            if (!this.hostDataConnection || !this.hostDataConnection.open) {
                console.log("{" + this.options.log_id + "} ", "adding data to local cache to send once host connection is established", data, this._messageToSend)
                if (this._peerlist.length > 0)
                    this._messageToSend.push({
                        "data": data,
                        "peerlist": this._peerlist
                    })
            } else {
                let msg_id = uuidv4()
                this.hostDataConnection.send({
                    "message": data,
                    "id": msg_id
                })
                this._messageToSend.push({
                    "data": data,
                    "peerlist": this._peerlist,
                    "msg_id": msg_id
                })
                this.hostDataConnection.on("data", (data) => {
                    if (data.message_reciept) {
                        if (this._messageToSend)
                            this._messageToSend.filter(msg => msg.msg_id !== data.message_reciept)

                    }
                })
                this.hostDataConnection.on("error", (err) => {
                    console.log("{" + this.options.log_id + "} ", " r", err)
                })
                this.hostDataConnection.on("close", () => {
                    console.log("{" + this.options.log_id + "} ", "host data connection close")
                })
            }

        } else {
            this.getPeers().forEach((id) => {
                this.currentPeer.sendData(id, data)
            })
        }
    }

    call = (stream, usePreviousStream = true) => {
        if (this.currentPeer._setCurrentStream(stream, usePreviousStream))
            if (this.hostDataConnection) {
                this.hostDataConnection.send({
                    "call": true
                })
            }
    }

    disconnectCall = () => {
        this.currentPeer._setCurrentStream(false)
        if (this.hostDataConnection) {
            this.hostDataConnection.send({
                "call": false
            })
        }
    }

    /**
     * this is a object which you can set to the peer
     * this data will be recieved by every peer which joines the mesh with the peer id
     * this can be used to set things will peer name or unique data relating to a peer
     */
    _dataToPersist = false
    initData = (data) => {
        this._dataToPersist = data
        if (this.hostDataConnection) {
            this.hostDataConnection.send({
                "initData": data
            })
        }
    }

    /**
     * create a new connection with the host of the network
     * also check if host has existing peers already connected to it
     * @param {*} cb callback which is called once connection is established
     */
    _hostConnectionEventSetup = false
    _hostDataConnection = false
    _connectToHost = (cb) => {
        console.log("{" + this.options.log_id + "} ", "owner doesn't exist either create or connect to owner")

        //doing this should ideally reduce time for mesh sync because owner will existing always except for the first host
        let dc = this.currentPeer.connectWithPeer(this.room)

        // if we don't add this this event get called multiple times when host disconnects. everytime a host disconects this gets call again
        // so if host disconnects 3 times, the below events get called 3 times
        dc.on("open", () => {
            console.log("{" + this.options.log_id + "} ", "data connection open with host")
            this.hostDataConnection = dc
            this.emit("hostconnected", false)
            console.log("{" + this.options.log_id + "} ", "check pending messages from here 356")
            this._checkPendingMessages()
        })

        //peer unavaiable handle above now 



    }

    /**
     * if sync has already started
     */
    _syncStarted = false

    /**
     * start sync for the mesh
     * @returns true if sync is started, false if sync is already under way
     */
    _syncMesh = () => {
        if (!this.currentPeer || !this.isjoined) {
            console.log("{" + this.options.log_id + "} ", "to early to call sync, first peer needs to join network")
            return true
        }
        if (!this._syncStarted) {
            this._syncStarted = true
            this.issync = false
            console.log("{" + this.options.log_id + "} ", "sync mesh")
            if (!this.hostDataConnection) {
                this._connectToHost()
                this.once("hostconnected", () => {
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

    /**
     * waiting for sync to complete
     * @returns return a Promise which resolves when sync is completed in the mesh or times-out
     */
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
                    peerlist.forEach(peer => {
                        this._addInternalPeer(peer)
                    })
                    resolve(peerlist)
                })
            }
        })
    }

    /**
     * cleanup the mesh network for the current peer
     */
    cleanup = () => {
        this._closePeerEvents()
        this.disconnectCall()
        this.isjoined = false
        this._dataToPersist = false
        this.currentPeer && this.currentPeer.cleanup()
        this.hostDataConnection && this.hostDataConnection.close()
        this.hostPeer && this.hostPeer.cleanup()
        this.room = false
        this._peerlist = []
    }
    /**
     * @deprecated
     * this is not to be used. this is to disconnect host from the current peer and allow the network to choose a new host
     */
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