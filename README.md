# Peerjs Mesh #

A very simple implementation of webrtc p2p mesh build on top of peerjs
This is quite experimental at this stage and only in early development mode.

Here is an example of how this works https://github.com/manishiitg/peerjs-mesh-example  

This example is based on reactjs

## API ##

Import it in your project using

```
import { mesh } from "@manishiitg/peerjs-mesh"

```

Next, you cannot to a mesh using 

```
let mesh = mesh(roomid)
```
here room is a unique id for every peer in this mesh. 

More options 

```
let mesh = mesh("XXXXX",
            {
                "log_id": "peer" + idx,  //optional, this is only for debugging purposes
                
                "initData": {  // optional this is only if want to setup initial data for the peer which all other peers in the mesh will recieved
                    "name": idx
                }
                 "connection": { //optional connection parameters
                     "host": "peerjs.platoo-platform.com", 
                     "secure": true,
                     "path": "myapp"
                 }
            }
        )

```
There are many more options possible refer to documentation for it.

#### Events ####

```

mesh.on("joined", (id) => {
    // this is fired when peer joins the peerjs network.
    // this event doesn't mean the peer has joined the mesh
})


mesh.on("sync", (issync) => {
    // this event is fired when the peer is connected to the mesh
    // and in sycn with other peers as well
})


await mesh.waitToJoin() 
// this can be used to wait for the join event

await mesh.waitToSync()
// this can be used to wait for the mesh to sync in the network

mesh.send({....}) 
// send your data object to the mesh

mesh.call(stream)

// send your stream to the mesh

mesh.disconnectCall()

// stop your stream to the mesh


mesh.on("data", (data) => {
    // data sent by another peer in the mesh
})

mesh.on("stream", (stream, id) => {
    // when a new peer connects to the mesh and shares stream
})

mesh.on("streamdrop", (id) => {
    // when a peer stops streaming
})

mesh.on("initData", (id, data) => {
        // here id is the unique of another peer
        // data is the data set by the peer        
})

mesh.on("peerjoined", (id, peerlist) => {
    // when a new peer joines the mesh
})

mesh.on("peerdropped", (id, peerlist) => {
    // when a new peer drops the mesh
})

mesh.on("hostconnected", (ishost) => {
            // when the current peer connects with the host
            // ishost means current peer is the other or not
        })

mesh.on("error", (msg) => {
     
        })

mesh.cleanup()
// should be called to disconnect and cleanup peer from the mesh
// this will not close the mesh other peers will still remain connect

```



#### How this works? ####

This mesh works based on a host. The host a special peer who's id is same as the room name.

All peers will connect to this host and data will be exchanged between this peer as host.

Host will be started on the same instance as the first peer connects to the mesh. This means first peer and the host will started together.

Next, when any of peers connect to this mesh a connection will be established between the peer and host.

Host will have the id same as the mesh name, so any new peer can easily find and connect to the host. 

This makes peer descovery very easy.

The main issue comes when the host closes or disconnects. 

To solve this problem, when the host disconnects all other peers will automatically start to create a host but only will be created.

This is because peerjs allows only unique peers for it.

Then all other peers will again establish connect to this new host.


### TODO ###

1. create a simple demo website in which people can do group calls 
2. if more people join on a call maybe implement a list or paging system. with ability to pin people as well
3. add support to change stream in between (done)

##### Ideas for mesh modes #####

Mesh Mode: Host

Peers don't connect to each other at all. All peers communicate with a main host and the host relays the data always.
But this will only work on data connection not stream, so its of no use.

Pros

As this doesn't require all peers to connect with each other this will network load

Cons

Network latency now depends on the host, as the data/stream goes though the host. If host network is slow, all peers will face high latency.

The problem will come only when host goes away and it takes time for all peers to the new host again. 

The host needs to manage all data in a network, this will result in high network load for host. But in a full p2p mesh this is a problem for all peers not just host


Mesh Mode: Full

All peers are connected to each other.

In this also there is a problem that mesh sync takes time because every notes needs to connect to all other.
So if there are 10 nodes, this means 10x10 connections. This takes lot of time as the size of network grows.
So for data connection host mode is good and nodes get connected fast as well.

Plus browser has a webrtc connection limit also

Pros

Peers connect to each other directly, so even if the host goes down the mesh is able to recover easily.

Cons

High network usage as all hosts are connected to each other so cannot scale to lot of peers
