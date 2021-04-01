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
