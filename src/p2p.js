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
    recoveringBlocks: [],
    recoveredBlocks: [],
    recovering: false,
    discoveryWorker: () => {
        chain.generateTop20Miner(function(miners) {
            for (let i = 0; i < miners.length; i++) {
                if (miners[i].name == process.env.NODE_OWNER) continue
                if (!miners[i].json) continue

                // are we already connected?
                var connected = false
                for (let y = 0; y < p2p.sockets.length; y++) {
                    if (!p2p.sockets[y] || !p2p.sockets[y].node_status) continue
                    if (miners[i].name == p2p.sockets[y].node_status.owner)
                        connected = true
                }

                if (!connected) {
                    var json = miners[i].json
                    if (json.node && json.node.ws) {
                        p2p.connect([json.node.ws])
                    }
                }
            }
        })
    },
    init: () => {
        var server = new WebSocket.Server({port: p2p_port});
        server.on('connection', ws => p2p.handshake(ws));
        logr.info('Listening websocket p2p port on: ' + p2p_port);
        setTimeout(function(){p2p.recover()}, 1500)
        if (!process.env.NO_DISCOVERY) {
            setInterval(function(){p2p.discoveryWorker()}, 60000)
            p2p.discoveryWorker()
        }
    },
    connect: (newPeers) => {
        newPeers.forEach((peer) => {
            var ws = new WebSocket(peer);
            ws.on('open', () => p2p.handshake(ws));
            ws.on('error', () => {
                logr.warn('peer connection failed', peer)
            });
        });
    },
    handshake: (ws) => {
        if (process.env.OFFLINE) {
            logr.warn('Incoming handshake refused because OFFLINE')
            ws.close(); return
        }
        // close connection if we already have this peer ip in our connected sockets
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i]._socket.remoteAddress == ws._socket.remoteAddress) {
                ws.close()
                return
            }
        logr.debug('Handshaking new peer', ws.url || ws._socket.remoteAddress)
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
                logr.warn('Received non-JSON, doing nothing ;)')
            }
            
            switch (message.t) {
                case MessageType.QUERY_NODE_STATUS:
                    var d = {
                        origin_block: originHash,
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
                            throw err;
                        if (block)
                            p2p.sendJSON(ws, {t:MessageType.BLOCK, d:block})
                    })
                    break;

                case MessageType.BLOCK:
                    for (let i = 0; i < p2p.recoveringBlocks.length; i++)
                        if (p2p.recoveringBlocks[i] == message.d._id) {
                            p2p.recoveringBlocks.splice(i, 1)
                            break
                        }
                            
                    if (chain.getLatestBlock()._id+1 == message.d._id) {
                        function addRecursive(block) {
                            chain.validateAndAddBlock(block, function(err, newBlock) {
                                if (err)
                                    logr.error('Error Replay', newBlock)
                                else {
                                    delete p2p.recoveredBlocks[newBlock._id]
                                    p2p.recover()
                                    if (p2p.recoveredBlocks[chain.getLatestBlock()._id+1]) {
                                        setTimeout(function() {
                                            addRecursive(p2p.recoveredBlocks[chain.getLatestBlock()._id+1])
                                        }, 1)
                                    }
                                }
                                    
                            })
                        }
                        addRecursive(message.d)
                    } else {
                        p2p.recoveredBlocks[message.d._id] = message.d
                        p2p.recover()
                    }
                    break;

                case MessageType.NEW_BLOCK:
                    if (!p2p.sockets[p2p.sockets.indexOf(ws)] || !p2p.sockets[p2p.sockets.indexOf(ws)].node_status) return
                    p2p.sockets[p2p.sockets.indexOf(ws)].node_status.head_block = message.d._id
                    if (message.d._id != chain.getLatestBlock()._id+1)
                        return
                    if (!p2p.processing) {
                        p2p.processing = true
                        chain.validateAndAddBlock(message.d, function(err, newBlock) {
                            p2p.processing = false
                            if (err)
                                logr.error('Error New Block', newBlock)
                            else
                                p2p.recovering = false
                        })
                    }
                    break;
                case MessageType.NEW_TX:
                    var tx = message.d
                    transaction.isValid(tx, new Date().getTime(), function(isValid) {
                        if (!isValid) {
                            logr.warn('Invalid tx', tx)
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
    recover: () => {
        if (!p2p.sockets || p2p.sockets.length == 0) return;
        if (Object.keys(p2p.recoveredBlocks).length + p2p.recoveringBlocks.length > 100) return;
        if (!p2p.recovering) p2p.recovering = chain.getLatestBlock()._id

        p2p.recovering++
        var peersAhead = []
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i].node_status 
            && p2p.sockets[i].node_status.head_block > chain.getLatestBlock()._id
            && p2p.sockets[i].node_status.origin_block == originHash)
                peersAhead.push(p2p.sockets[i])
        
        if (peersAhead.length == 0) {
            p2p.recovering = false
            return
        }
            
        var champion = peersAhead[Math.floor(Math.random()*peersAhead.length)]
        p2p.sendJSON(champion, {t: MessageType.QUERY_BLOCK, d:p2p.recovering})
        p2p.recoveringBlocks.push(p2p.recovering)

        if (p2p.recovering%2) p2p.recover()
    },
    errorHandler: (ws) => {
        ws.on('close', () => p2p.closeConnection(ws));
        ws.on('error', () => p2p.closeConnection(ws));
    },
    closeConnection: (ws) => {
        p2p.sockets.splice(p2p.sockets.indexOf(ws), 1)
        logr.debug('a peer disconnected, '+p2p.sockets.length+' peers left')
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