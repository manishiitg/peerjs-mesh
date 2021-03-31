import { useEffect, useRef, useState } from "react"
import classnames from "classnames"
import { mesh } from "../lib/mesh"
import VideoStream from "./VideoStream"

const PeerNode = ({ roomId, idx, removePeer, onData, onSync, onIsHost, meshData, sendDataToMeshAndVerify }) => {

    const peer = useRef(false)

    const [name, setName] = useState()
    const [id, setId] = useState()
    const [joined, setJoined] = useState(false)
    const [sync, setSync] = useState(false)
    const [peers, setPeers] = useState([])

    const [isHostPeer, setIsHostPeer] = useState(false)

    const [data, setData] = useState(false)

    const [error, setError] = useState(false)

    const [streams, setStreams] = useState({})

    const stopCall = () => {
        setStreams(streams => {
            let stream = streams["mine"]
            if (!stream) return streams
            console.log(stream, streams)
            stream.getTracks().forEach(function (track) {
                track.stop();
            });
            peer.current.disconnectCall(stream)
            delete streams["mine"]
            return Object.assign({}, streams)
        })
    }
    const startCall = () => {
        var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        getUserMedia({ video: true, audio: true }, function (stream) {

            peer.current.call(stream)

            setStreams(streams => {
                streams["mine"] = stream
                return Object.assign({}, streams)
            })
        })
    }
    useEffect(() => {
        console.log("================= peer joining network =============")

        peer.current = mesh(roomId,
            {
                "log_id": "peer" + idx,
                "initData": {
                    "name": idx
                }
                // "connection": {
                //     "host": "peerjs.platoo-platform.com",
                //     "secure": true,
                //     "path": "myapp"
                // }
            }
        )

        startCall()

        peer.current.on("initData", (id, data) => {
            console.log("initDatainitDatainitDatainitData", id, data)
        })
        peer.current.on("joined", (id) => {
            setId(id)
            setJoined(true)
            setName("peer" + idx)
        })
        peer.current.on("sync", (issync) => {
            setSync(issync)
            setError("")
            if (issync) onSync(idx)
        })

        peer.current.on("stream", (stream, id) => {
            setStreams(streams => {
                streams[id] = stream
                return Object.assign({}, streams)
            })
        })
        peer.current.on("streamdrop", (id) => {
            setStreams(streams => {
                console.log("streamdropstreamdropstreamdropstreamdrop", id, idx, streams)
                delete streams[id]
                console.log("streamsss", streams)
                return Object.assign({}, streams)
            })
        })
        peer.current.on("peerjoined", (id, peerlist) => {
            setPeers(Object.assign([], peerlist))
        })
        peer.current.on("peerdropped", (id, peerlist) => {
            setStreams(streams => {
                delete streams[id]
                return { ...streams }
            })
            setPeers(Object.assign([], peerlist))
        })
        peer.current.on("hostconnected", (ishost) => {
            setIsHostPeer(ishost)
            if (ishost) onIsHost(idx)
        })
        peer.current.on("data", (data) => {
            setData(data)
            onData(idx, data)
        })
        peer.current.on("error", (msg) => {
            setError(msg + "")
        })

        return () => {
            setStreams([])
            peer.current.cleanup()
        }
    }, [])

    useEffect(() => {
        console.log("meshData", meshData)
        if (meshData["idx"] == idx || meshData["idx"] === - 1) {
            onData(idx, meshData["data"])
            peer.current.send(meshData["data"])
        }
    }, [meshData])
    return (
        <div className={classnames("card w-100 m-1", { "border-info": sync && !isHostPeer, "border-warning": isHostPeer })}>
            <div className="card-body">
                {name && <h5 className="card-title">{name}</h5>}
                {id && <h6 className="card-subtitle mb-2 text-muted">{id}</h6>}
                {data && <div className="card-text">
                    <pre className={"text-start"}>
                        {JSON.stringify(data, undefined, 2)}
                    </pre>
                </div>}
                <div className="d-flex flex-row flex-wrap">
                    {streams && Object.keys(streams).map((xid) => {
                        return (
                            <div className="d-flex" key={xid}>
                                <VideoStream stream={streams[xid]} id={xid} />
                            </div>
                        )
                    })}
                </div>


                <ul className="list-group list-group-flush">
                    {joined && <li className="list-group-item">Joined Meshed</li>}
                    {!sync && <div> Mesh Sync<div className="spinner-border text-center" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div></div>}
                    {peers && <li className="list-group-item">
                        Peers In Mesh: {peers.length}
                    </li>}
                </ul>
                <div className="card-body">
                    <div className="btn-group" role="group">

                        <button className="btn btn-outline-danger btn-small" onClick={() => {
                            removePeer(idx)
                        }}>Remove Peer</button>

                        {sync && <button className="btn btn-outline-danger btn-small" onClick={() => {
                            sendDataToMeshAndVerify(idx)
                        }}>Ping Random Data</button>}

                        {!streams["mine"] && <button className="btn btn-outline-danger btn-small" onClick={() => {
                            startCall()
                        }}>Start Call</button>}

                        {streams["mine"] && <button className="btn btn-outline-danger btn-small" onClick={() => {
                            stopCall()
                        }}>Stop Call</button>}
                    </div>
                </div>
                {error && <div className="alert alert-danger" role="alert">
                    {error}
                </div>}
            </div>
        </div>
    )
}
export default PeerNode