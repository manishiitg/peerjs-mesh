import { useEffect, useRef, useState } from "react";
import { mesh } from "../lib/mesh"
import PeerNode from "./PeerNode";
import isEqual from 'lodash/isEqual'
import { v4 as uuidv4 } from 'uuid';

const PeerClient = () => {
    const peer1 = useRef()
    const peer2 = useRef()
    const peer3 = useRef()
    const peer4 = useRef()

    useEffect(() => {
        return
        (async () => {

            let meshroom = "testing-123-2233-4-563456-3463463132412"
            console.log("================= peer1 joining network =============")
            peer1.current = mesh(meshroom, { "log_id": "peer1" })
            console.log("================= peer2 joining network =============")
            peer2.current = mesh(meshroom, { "log_id": "peer2" })

            peer1.current.on("peerdropped", (id) => {
                console.log("peer1 joined  mesh network", id)
            })
            peer1.current.on("peerdropped", (id) => {
                console.log("peer1 dropped  mesh network", id)
            })

            peer2.current.on("peerjoined", (id) => {
                console.log("peer2 joined  mesh network", id)
            })
            peer2.current.on("peerdropped", (id) => {
                console.log("peer2 dropped  mesh network", id)
            })

            await peer1.current.waitToJoin()
            let peers = await peer2.current.waitToSync()
            console.log("============== waitToSync() 2 ========", peers)
            console.log("============== peer1.getPeers() ========", peer2.current.getPeers())

            console.log("============== waitToSync() 1 ========", await peer1.current.waitToSync())
            console.log("============== peer1.getPeers() ========", peer1.current.getPeers())

            console.log("================= peer3 joining network =============")
            peer3.current = mesh(meshroom, { "log_id": "peer3" })


            await peer2.current.waitToSync()
            await peer3.current.waitToSync()



            console.log("============== peer1.getPeers() ========", peer1.current.getPeers())
            console.log("============== peer2.getPeers() ========", peer2.current.getPeers())

            peer4.current = mesh(meshroom, { "log_id": "peer4" })
            await peer4.current.waitToSync()

            console.log("============== peer4.getPeers() ========", peer4.current.getPeers())
            console.log("============== peer2.getPeers() ========", peer2.current.getPeers())

            console.log("================= peer1 sending data to mesh =============")
            peer1.current.send({
                "anyrandomdata": "123123",
                "name": "mesh1"
            })

            peer1.current.on("data", (data) => {
                console.log("data recieved by peer1", data)
            })
            peer2.current.on("data", (data) => {
                console.log("data recieved by peer2", data)
            })
            peer3.current.on("data", (data) => {
                console.log("data recieved by peer3", data)
            })


            peer3.current.cleanup()

            console.log("================= peer2 sending data to mesh =============")
            peer2.current.send({
                "myprofile": "mesh2"
            })

            console.log("===== test how host disconnects from mesh")
            peer1.current._disconnectHost()

            peer2.current.send("data", {
                "data after disconecting": true
            })

        })()

        return () => {
            peer1.current && peer1.current.isJoined() && peer1.current.cleanup()
            peer2.current && peer2.current.isJoined() && peer2.current.cleanup()
            peer3.current && peer3.current.isJoined() && peer3.current.cleanup()
        }
    }, [])

    const roomId = useRef("testing123-mesh-room-id")
    const [peers, setPeers] = useState([0])
    const removePeer = (idx) => {
        console.log("removing peer:", idx)
        onRemovePeer(idx)
        setPeers(peers => {
            let peers2 = peers.filter(i => {
                console.log(i, "!= ", idx, i !== idx)
                return i !== idx
            })
            console.log("peers", peers2)
            return peers2
        })
    }

    const [isTestRunning, setTestRunning] = useState({
        "started": false,
        "running": false
    })
    const [testResult, setTestResult] = useState(false)

    const testingFrameWork = useRef({
        "dataVerifyInMesh": {},
        "addPeer": {}
    })
    const onData = (idx, data) => {
        if (data.testidx) {
            let testid = data.testidx
            data = data.data
            if (testingFrameWork.current.dataVerifyInMesh.testid.isRunning) {

                if (!testingFrameWork.current.dataVerifyInMesh.testid.testResponse) {
                    testingFrameWork.current.dataVerifyInMesh.testid.testResponse = {}
                }
                testingFrameWork.current.dataVerifyInMesh.testid.testResponse[idx] = data

                setTestResult('Data Recieved in Mesh:' + testid + " - " + + Object.keys(testingFrameWork.current.dataVerifyInMesh.testid.testResponse).length + " / " + Object.keys(peerSyncList).length)
                if (Object.keys(testingFrameWork.current.dataVerifyInMesh.testid.testResponse).length >= Object.keys(peerSyncList).length) {
                    let keys = Object.keys(testingFrameWork.current.dataVerifyInMesh.testid.testResponse).filter((idx) => {
                        let data = testingFrameWork.current.dataVerifyInMesh.testid.testResponse[idx]
                        console.log(data, "===", testingFrameWork.current.dataVerifyInMesh.testid.dataToVerify, " - ", isEqual(data === testingFrameWork.current.dataVerifyInMesh.testid.dataToVerify))
                        return isEqual(data, testingFrameWork.current.dataVerifyInMesh.testid.dataToVerify)
                    })
                    if (keys.length === Object.keys(testingFrameWork.current.dataVerifyInMesh.testid.testResponse).length) {
                        setTestResult("Data Synced")
                    } else {
                        setTestResult("Data Failed")
                    }
                    setTestRunning(running => {
                        return { ...running, "running": false }
                    })
                }
            }
        } else {
            console.log("data ", data)
        }
    }

    const [peerSyncList, setPeerSyncList] = useState({})
    const onSync = (idx) => {
        setPeerSyncList(syncList => {
            syncList[idx] = true
            return syncList
        })
        if (testingFrameWork.current.addPeer.isRunning) {


            setTestResult('Peer Added To Mesh ' + Object.keys(peerSyncList).length + " / " + testingFrameWork.current.addPeer.no_of_peers)
            if (Object.keys(peerSyncList).length === testingFrameWork.current.addPeer.no_of_peers) {

                setTestRunning(running => {
                    return { ...running, "running": false }
                })
            }
        }
    }

    const [meshData, setMeshData] = useState(false)
    const sendDataToMeshAndVerify = (idx, data) => {
        testingFrameWork.current.addPeer.isRunning = false
        setTestRunning({ "started": true, "running": true })
        setTestResult("")

        let testid = uuidv4()

        testingFrameWork.current.dataVerifyInMesh.testid = {}

        testingFrameWork.current.dataVerifyInMesh.testid.dataToVerify = data ? data : Math.random()
        testingFrameWork.current.dataVerifyInMesh.testid.isRunning = true
        let peerKeys = Object.keys(peerSyncList)
        let rand = Math.floor(Math.random() * peerKeys.length)

        console.log("============================ sending data via peer ============================ ", peerKeys[rand])
        setMeshData({
            "idx": idx ? idx : peerKeys[rand],
            "data": {
                "data": testingFrameWork.current.dataVerifyInMesh.testid.dataToVerify,
                "testidx": testid
            }
        })
    }

    const onRemovePeer = (idx) => {
        setPeerSyncList(syncList => {
            delete syncList[idx]
            return Object.assign({}, syncList)
        })
    }
    const removeHostAndSendData = () => {
        console.log("hostPeer.currenthostPeer.current", hostPeer.current)
        onRemovePeer(hostPeer.current)
        setPeers(peers => {
            return peers.filter(idx => {
                return idx !== hostPeer.current
            })
        })
        setTimeout(() => {
            sendDataToMeshAndVerify()
        }, 2000)
    }

    const hostPeer = useRef(false)
    const onIsHost = (idx) => {
        hostPeer.current = idx
    }

    const [peercount, setPeercount] = useState(1)
    return (
        <div className="container-fluid mx-auto p-3 py-md-5">
            <header className="d-flex d-flex justify-content-between pb-3 mb-5 border-bottom">
                <a href="#" className="d-flex text-dark text-decoration-none">
                    <img src="https://peerjs.com/media/logo.png" />
                    <span className="fs-4">Peerjs Mesh Demo</span>
                </a>
                <h6 className="text-muted">{roomId.current}</h6>
                <ul className="navbar-nav">
                    <li className="nav-item">
                        <div className="input-group">
                            <input type="number" className="form-control" value={peercount} onChange={(evt) => {
                                setPeercount(evt.target.value)
                            }} />
                            <button className="btn btn-outline-primary" onClick={() => {
                                setPeers(peers => {
                                    let max_peer_id = peers.reduce((prev, cur) => prev > cur ? prev : cur, 0)
                                    testingFrameWork.current.addPeer.isRunning = true
                                    testingFrameWork.current.addPeer.no_of_peers = parseInt(peercount) + peers.length
                                    setTestRunning({ "started": true, "running": true })
                                    setTestResult("")
                                    if (peercount > 0) {
                                        for (let k = 0; k < parseInt(peercount); k++) {
                                            max_peer_id = max_peer_id + 1
                                            peers.push(max_peer_id)
                                        }
                                        return Object.assign([], peers)
                                    } else {
                                        console.log("peerspeerspeerspeerspeers", peers)
                                        return peers
                                    }
                                })
                            }}>Add Peer</button>
                            <div className="btn-group" role="group">
                                <button id="btnGroupDrop1" type="button" className="btn btn-primary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                    Tests
                                </button>
                                <ul className="dropdown-menu" aria-labelledby="btnGroupDrop1">
                                    <li onClick={() => {
                                        sendDataToMeshAndVerify()
                                    }}>
                                        <a className="dropdown-item" href="#">Send Data To Mesh And Verify</a>
                                    </li>

                                    <li onClick={() => {
                                        removeHostAndSendData()
                                    }}>
                                        <a className="dropdown-item" href="#">Remove Host and Send Data</a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </li>
                </ul>
            </header>

            <main className="container-fluid">
                {isTestRunning.started && <div className="alert alert-info" role="alert">
                    {testResult}
                    {isTestRunning.running && <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>}
                </div>}
                <div className="row row-cols-2">
                    {peers.map((peer) => {
                        return (
                            <div className="col" key={peer}>
                                <PeerNode
                                    roomId={roomId.current}
                                    idx={peer}
                                    onSync={onSync}
                                    onData={onData}
                                    onIsHost={onIsHost}
                                    meshData={meshData}
                                    sendDataToMeshAndVerify={sendDataToMeshAndVerify}
                                    removePeer={removePeer} />
                            </div>
                        )
                    })}
                </div>

            </main>

        </div >
    )
}

export default PeerClient