const EventEmitter = require('events');

//not used depricated
export default class QueryMesh extends EventEmitter {
    options = {}
    constructor(options) {
        super()
        this.options = options
    }

    query = (peer, room, _startnodeidx, callback, _nodeidx = false) => {
        if (!_nodeidx) {
            _nodeidx = _startnodeidx
        }
        if (_startnodeidx === 0) {
            //this is either the first node itself or other nodes got disconnected
            // need to query other nodes
            _nodeidx = _nodeidx + 1
            this._connectToPeer(peer, room + "-" + _nodeidx, (connected, dc) => {
                if (connected) {
                    callback(dc, _nodeidx)
                } else {
                    console.log(_nodeidx, "<", this.options.max_mesh_peers)
                    if (_nodeidx < this.options.max_mesh_peers)
                        this.query(peer, room, _startnodeidx, callback, _nodeidx)
                    else
                        callback(false)
                }
            })

        } else {
            // this mean a node is joining at id more than 0, so there must be a node in the previous id
            _nodeidx = _nodeidx - 1
            this._connectToPeer(peer, room + "-" + _nodeidx, (connected, peer) => {
                if (connected) {
                    callback(peer, _nodeidx)
                } else {
                    if (_nodeidx > 0)
                        this.query(peer, room, _startnodeidx, callback, _nodeidx)
                    else
                        callback(false)
                }
            })
        }
    }

    _connectToPeer = (peer, id, callback) => {
        try {

            console.log("peer", peer)
            console.log("{" + this.options.log_id + "} ", "_connectToPeer", id)
            const dc = peer.connect(id)
            peer.on("open", () => {
                console.log("{" + this.options.log_id + "} ", "peer data connection opened", id)
                callback(true, dc)
            })
            peer.on("error", (err) => {
                console.log("{" + this.options.log_id + "} ", "peer data connection errored", id)
                callback(false)
            })
        } catch (error) {
            console.warn(error)
            callback(false)
        }
    }
}