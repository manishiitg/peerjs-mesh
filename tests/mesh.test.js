import { WebSocket, Server } from 'mock-socket';

class ChatApp {

    constructor(url) {
        this.messages = [];
        this.connection = new WebSocket(url);

        this.connection.onmessage = event => {
            console.log("on meessage");
            this.messages.push(event.data);
        };
    }

    sendMessage(message) {
        this.connection.send(message);
    }
}

const createMockServer = () => {

    const fakeURL = 'ws://localhost:8080';
    const mockServer = new Server(fakeURL);

    console.log("create mock server");
    mockServer.on('connection', socket => {
        
        console.log("connection")
        socket.on('message', data => {
            console.log("message", data)
            socket.send('test message from mock server');
        });

    });

    return mockServer;
}

describe("mock socket", function () {

    let mockServer;

    beforeEach(function () {
        mockServer = createMockServer();
    });

    it("test socket mock 1", (done) => {

        const app = new ChatApp('ws://localhost:8080');
        app.sendMessage('test message from app 1');
        setTimeout(() => {
            expect(app.messages.length).toEqual(1);
            expect(app.messages[0]).toEqual('test message from mock server');
            console.log(app.messages);
            done();
        }, 100);

    })

    it("test socket mock 2", (done) => {

        const app = new ChatApp('ws://localhost:8080');
        app.sendMessage('test message from app 2');
        setTimeout(() => {
            expect(app.messages.length).toEqual(1);
            expect(app.messages[0]).toEqual('test message from mock server');
            console.log(app.messages);
            done();
        }, 100);

    });

    afterEach(function () {
        mockServer.stop();
    });

});