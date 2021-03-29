import MeshHost from "./MeshHost";
import MeshPeer from "./MeshPeer";
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
        let joinTimeout = setTimeout(() => {
            this.isjoined = false
            this.emit("error", "Peer timed out before joining network")
        }, this.options.join_timeout)
        this.currentPeer.on("joined", (id) => {
            clearTimeout(joinTimeout)
            this.id = id
            this.emit("joined", id)
            this.isjoined = true
            this._listenPeerEvents()
            this._syncMesh()
        })
        this.currentPeer.on("left", (id, err) => {
            this.isjoined = false
            this.emit("error", "Peer unable to join peer network")
        })
    }
    /**
     * handle peer joined event on the mesh network
     * @param {*} id peer id of the joined peer
     */
    _listenPeerJoined = (id) => {
        console.log("{" + this.options.log_id + "} ", "new peer added to mesh", id)
        if (this._peerlist.indexOf(id) !== 0) this._peerlist.push(id)
        this.emit("peerjoined", id)
    }
    /**
     * handle peer dropped from the mesh
     * @param {*} id peer id 
     */
    _listenPeerDropped = (id) => {
        this.emit("peerdropped", id)
        if (this._peerlist.indexOf(id) >= 0) this._peerlist = this._peerlist.filter(p => p !== id)
    }
    /**
     * handle peer sync completed 
     * @param {*} connectedPeers list of all peers in the network
     */
    _listenSync = (connectedPeers) => {
        console.log("{" + this.options.log_id + "} ", "sync completed", connectedPeers)
        this.issync = true
        this.emit("sync", connectedPeers)
        this._syncStarted = false
    }
    /**
     * handle error
     * @param {*} err 
     */
    _listenError = (err) => {
        this.emit("error", err)
    }
    /**
     * listen to host getting dropped from the mesh and handle it 
     */
    _listenHostDropped = () => {
        console.log("{" + this.options.log_id + "} ", "host has dropped this is a major issue need to create a new host")
        this.hostPeer = false
        this.hostDataConnection = false
        this._syncMesh()
    }
    /**
     * listen for data recieved in the mesh
     * @param {*} data 
     * @returns 
     */
    _listenData = data => this.emit("data", data)

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
    }
    /**
     * stop listing to all peer events to be used for cleanup
     */
    _closePeerEvents = () => {
        this.currentPeer.off("peerjoined", this._listenPeerJoined)
        this.currentPeer.off("peerdropped", this._listenPeerDropped)
        this.currentPeer.off("sync", this._listenSync)
        this.currentPeer.off("error", this._listenError)
        this.currentPeer.off("data", this._listenData)
        this.currentPeer.off("hostdropped", this._listenHostDropped)
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
     * send data to all peers in the mesh
     * @param {*} data data object to be sent
     */
    send = (data) => {
        if (!this.isjoined || this.sync) {
            throw new Error("Can send data only once peer has synced with the network")
        }
        if (this.options.mesh_mode === "host") {

            this.hostDataConnection.send({
                "message": data
            })

        } else {
            this.getPeers().forEach((id) => {
                this.currentPeer.sendData(id, data)
            })
        }
    }

    /**
     * create a new connection with the host of the network
     * @param {*} cb callback which is called once connection is established
     */
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
        this.isjoined = false
        this.currentPeer && this.currentPeer.cleanup()
        this.hostDataConnection && this.hostDataConnection.close()
        this.hostPeer && this.hostPeer.cleanup()
        this.currentPeer = false
        this.room = false
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