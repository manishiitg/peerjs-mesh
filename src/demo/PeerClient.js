import { useEffect, useRef } from "react";
import { mesh } from "../lib/mesh"

const PeerClient = () => {
    const peer1 = useRef()
    const peer2 = useRef()
    const peer3 = useRef()
    const peer4 = useRef()

    useEffect(() => {
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

    return null
}

export default PeerClient