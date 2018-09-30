var p2p_port = process.env.P2P_PORT || 6001;
var WebSocket = require("ws");

var MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2,
    NODE_INFO: 3,
};

var p2p = {
    sockets: [],
    init: () => {
        var server = new WebSocket.Server({port: p2p_port});
        server.on('connection', ws => p2p.handshake(ws));
        console.log('Listening websocket p2p port on: ' + p2p_port);
    },
    connect: (newPeers) => {
        newPeers.forEach((peer) => {
            var ws = new WebSocket(peer);
            ws.on('open', () => p2p.handshake(ws));
            ws.on('error', () => {
                console.log('peer connection failed')
            });
        });
    },
    handshake: (ws) => {
        p2p.sockets.push(ws);
        p2p.messageHandler(ws);
        p2p.errorHandler(ws);
        p2p.sendJSON(ws, {'type': MessageType.QUERY_LATEST});
    },
    messageHandler: (ws) => {
        ws.on('message', (data) => {
            var message = JSON.parse(data);
            console.log('Received message ' + JSON.stringify(message));
            switch (message.type) {
                case MessageType.QUERY_LATEST:
                    break;
                case MessageType.QUERY_ALL:
                    break;
                case MessageType.RESPONSE_BLOCKCHAIN:
                    break;
            }
        });
    },
    errorHandler: (ws) => {
        var closeConnection = (ws) => {
            p2p.sockets.splice(p2p.sockets.indexOf(ws), 1);
        };
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    },
    sendJSON: (ws, message) => ws.send(JSON.stringify(message)),
    broadcast: (message) => p2p.sockets.forEach(socket => p2p.sendJSON(socket, message))
}

module.exports = p2p