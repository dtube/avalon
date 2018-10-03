var p2p_port = process.env.P2P_PORT || 6001;
var WebSocket = require("ws");
var chain = require('./chain.js')

var MessageType = {
    QUERY_NODE_STATUS: 0,
    NODE_STATUS: 1,
    QUERY_BLOCK: 2,
    BLOCK: 3,
    NEW_BLOCK: 4,
    NEW_TX: 5
};

var p2p = {
    sockets: [],
    recovering: false,
    init: () => {
        var server = new WebSocket.Server({port: p2p_port});
        server.on('connection', ws => p2p.handshake(ws));
        console.log('Listening websocket p2p port on: ' + p2p_port);
        setTimeout(function(){p2p.recoverAfterCrash()}, 1500)
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
        p2p.sendJSON(ws, {t: MessageType.QUERY_NODE_STATUS});
    },
    messageHandler: (ws) => {
        ws.on('message', (data) => {
            try {
                var message = JSON.parse(data);
            } catch(e) {
                console.log('Received non-JSON, doing nothing ;)')
            }
            
            //console.log('Received message ' + JSON.stringify(message.t));
            switch (message.t) {
                case MessageType.QUERY_NODE_STATUS:
                    var d = {
                        head_block: chain.getLatestBlock()._id,
                        owner: process.env.NODE_OWNER
                    }
                    p2p.sendJSON(ws, {t: MessageType.NODE_STATUS, d:d})
                    break;

                case MessageType.NODE_STATUS:
                    p2p.sockets[p2p.sockets.indexOf(ws)].node_status = message.d
                    break;

                case MessageType.QUERY_BLOCK:
                    db.collection('blocks').findOne({_id: message.d}, function(err, block) {
                        if (err)
                            console.log(err)
                        if (block)
                            p2p.sendJSON(ws, {t:MessageType.BLOCK, d:block})
                    })
                    break;

                case MessageType.BLOCK:
                    if (p2p.recovering) {
                        chain.validateAndAddBlock(message.d, function(err, newBlock) {
                            if (err)
                                console.log('Error', newBlock)
                            else
                                p2p.recoverAfterCrash()
                        })
                    }
                    break;

                case MessageType.NEW_BLOCK:
                    p2p.sockets[p2p.sockets.indexOf(ws)].node_status.head_block = message.d._id
                    chain.validateAndAddBlock(message.d, function(err, newBlock) {
                        if (err)
                            console.log('Error', newBlock)
                        else
                            p2p.recovering = false
                    })
                    break;
                case MessageType.NEW_TX:
                    var tx = message.d
                    transaction.isValid(tx, new Date().getTime(), function(isValid) {
                        if (!isValid) {
                            console.log('Invalid tx', tx)
                        } else {
                            if (!transaction.isInPool(tx)) {
                                transaction.addToPool([tx])
                                p2p.broadcast({t:5, d:tx})
                            } 
                        }
                    })
                    break;
            }
        });
    },
    recoverAfterCrash: () => {
        if (!p2p.sockets || p2p.sockets.length == 0) return;
        // shuffle so it uses a random one
        var shuffledSockets = []
        var tmpSockets = []
        var rand = Math.floor(Math.random() * 1000000000)

        for (let i = 0; i < p2p.sockets.length; i++)
            tmpSockets.push(p2p.sockets[i])

        while (tmpSockets.length > 0) {
            var i = rand%tmpSockets.length
            shuffledSockets.push(tmpSockets[i])
            tmpSockets.splice(i, 1)
        }
        
        for (let i = 0; i < shuffledSockets.length; i++) {
            if (shuffledSockets[i].node_status.head_block>chain.getLatestBlock()._id) {
                p2p.recovering = true
                p2p.sendJSON(shuffledSockets[i], {t: MessageType.QUERY_BLOCK, d:chain.getLatestBlock()._id+1})
                break;
            }
        }
    },
    errorHandler: (ws) => {
        var closeConnection = (ws) => {
            console.log('p2p co closed')
            p2p.sockets.splice(p2p.sockets.indexOf(ws), 1);
        };
        ws.on('close', () => closeConnection(ws));
        ws.on('error', () => closeConnection(ws));
    },
    sendJSON: (ws, d) => ws.send(JSON.stringify(d)),
    broadcast: (d) => p2p.sockets.forEach(ws => p2p.sendJSON(ws, d)),
    broadcastBlock: (block) => {
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i].node_status && p2p.sockets[i].node_status.head_block < block._id)
                p2p.broadcast({t:4,d:block})
    }
}

module.exports = p2p