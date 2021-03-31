import Peer, { peerjs } from "peerjs"

//enable support for WebRTC
peerjs.util.supports.audioVideo = true;
peerjs.util.randomToken = () => 'testToken';

import "./fake"
import { Server } from 'mock-socket';

const createMockServer = () => {
    const fakeURL = 'ws://localhost:8080/peerjs?key=peerjs&id=1&token=testToken';
    const mockServer = new Server(fakeURL);

    console.log("create mock server")
    mockServer.on('connection', socket => {

        console.log("connection")
        socket.on('message', data => {
            console.log("message", data)
            socket.send('test message from mock server');
        });

        socket.send(JSON.stringify({ type: "open" }));
    });

    return mockServer;
}

describe("after call to peer #2", function () {
    let mockServer;

    beforeEach(function () {
        mockServer = createMockServer();
    });

    it("test socket mock", (don) => {
        class ChatApp {
            constructor(url) {
                this.messages = [];
                this.connection = new WebSocket(url);

                this.connection.onmessage = event => {
                    console.log("on meessage")
                    done()
                    this.messages.push(event.data);
                };
            }

            sendMessage(message) {
                this.connection.send(message);
            }
        }

        const app = new ChatApp("ws://localhost:8080/peerjs");
        app.sendMessage('test message from app'); // NOTE: this line creates a micro task

    })

    it("Peer#1 should has id #1", function () {


        // const peer1 = new Peer('1', { port: 8080, host: 'localhost', debug: 3 });

        // console.log("123123")
        // expect(peer1.open).toBeFalsy()
        // console.log("123123")

        // const mediaOptions = {
        //     metadata: { var: '123' },
        //     constraints: {
        //         mandatory: {
        //             OfferToReceiveAudio: true,
        //             OfferToReceiveVideo: true
        //         }
        //     }
        // };


        // peer1.once('open', (id) => {
        //     console.log("#3333")
        //     expect(id).toBe("1")
        //     //@ts-ignore
        //     expect(peer1._lastServerId).toBe('1');
        //     expect(peer1.disconnected).toBeFalsy()
        //     expect(peer1.destroyed).toBeFalsy()
        //     expect(peer1.open).toBeTruthy()

        //     peer1.destroy();

        //     expect(peer1.disconnected).toBeTruthy()
        //     expect(peer1.destroyed).toBeTruthy()
        //     expect(peer1.open).toBeFalsy()
        //     expect(peer1.connections).toHaveLength(0)

        //     done();
        // });
    });

    afterEach(function () {
        mockServer.stop();
    });
});