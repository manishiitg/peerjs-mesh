"use strict";
import MeshNetwork from "./MeshNetwork"

export const mesh = (room, options = {}) => {
    if (!room) {
        throw new Error("Room Name is mandatory to join a mesh")
    }
    let network = new MeshNetwork(room, options)
    network.addPeer()
    return network
}