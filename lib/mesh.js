"use strict";
import MeshNetwork from "./MeshNetwork"

/**
 * This is used to initialize the mesh and add current peer to the mesh
 * 
 * @param {*} room this is name of the mesh or room where all the peers will connect to. If there are multiple peers they will all join to the same room name
 * @param {*} options 
 * multiple options for the mesh network
 * log_id : this mainly use for logged purposes. this will assign a unique id to the console logs so u can easily debug a peer
 * retry: number of times to retry if there is some unexpected error when joining the peer network
 * retry_interval: after how many seconds to retry
 * join_timeout: maximum time to wait before a peer connects to mesh network or else returns a timeout error
 * sync_timeout: maximum time to wait before a peer syncs into a mesh netework or else returns a timeout error
 * max_mesh_peers: the maximum number of peers a mesh can have
 * mesh_mode: the mode of the mesh. either "host" or "full". read readme for more details on each of them
 * @returns it returns a MeshNetwork object 
 */
export const mesh = (room, options = {}) => {
    if (!options.log_id) {
        options.log_id = Math.floor(Math.random() * 100)
    }
    if (!options.retry) {
        options.retry = 2
    }
    if (!options.retry_interval) {
        options.retry_interval = 1 * 1000
    }
    if (!options.join_timeout) {
        options.join_timeout = -1
    }
    if (!options.sync_timeout) {
        options.sync_timeout = 60 * 1000
    }
    if (!options.max_mesh_peers) {
        options.max_mesh_peers = 10
    }
    if (!options.auto_call_peer) {
        options.auto_call_peer = 5
    }

    if (!options.mesh_limit) {
        options.mesh_limit = 10
    }

    if (!options.mesh_mode) {
        options.mesh_mode = "host"
        // in host mode, there is always on host
        // and host is responsible for communication with all peers
    }
    if (!options.do_health_check) {
        // do health pings 
        options.do_health_check = true
    }
    if (!options.do_health_check_interval) {
        // intervals to do health pings 
        options.do_health_check_interval = 2000
    }
    if (!room) {
        throw new Error("Room Name is mandatory to join a mesh")
    }
    let network = new MeshNetwork(room, options)
    network.addPeer()
    return network
}