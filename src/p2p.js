var p2p_port = process.env.P2P_PORT || 6001;
var WebSocket = require("ws");
var chain = require('./chain.js')
var secp256k1 = require('secp256k1')
var bs58 = require('base-x')(config.b58Alphabet)
var CryptoJS = require("crypto-js")

var MessageType = {
    QUERY_NODE_STATUS: 0,
    NODE_STATUS: 1,
    QUERY_BLOCK: 2,
    BLOCK: 3,
    NEW_BLOCK: 4,
    NEW_TX: 5,
    BLOCK_PRECOMMIT: 6,
    BLOCK_COMMIT: 7
};

var p2p = {
    sockets: [],
    possibleNextBlocks: [],
    recoveringBlocks: [],
    recoveredBlocks: [],
    recovering: false,
    discoveryWorker: () => {
        chain.generateLeaders(function(miners) {
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
            var ws = new WebSocket(peer)
            ws.on('open', () => p2p.handshake(ws))
            ws.on('error', () => {
                logr.warn('peer connection failed', peer)
            })
        });
    },
    handshake: (ws) => {
        if (process.env.OFFLINE) {
            logr.warn('Incoming handshake refused because OFFLINE')
            ws.close(); return
        }
        if (process.env.NO_DISCOVERY && p2p.sockets.length >= process.env.PEERS.split(',').length) {
            logr.warn('Incoming handshake refused because in NO_DISCOVERY mode and already peered enough')
            ws.close(); return
        }
        // close connection if we already have this peer ip in our connected sockets
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i]._socket.remoteAddress == ws._socket.remoteAddress
                && p2p.sockets[i]._socket.remotePort == ws._socket.remotePort) {
                ws.close()
                return
            }
        logr.debug('Handshaking new peer', ws.url || ws._socket.remoteAddress+':'+ws._socket.remotePort)
        p2p.sockets.push(ws);
        p2p.messageHandler(ws);
        p2p.errorHandler(ws);
        p2p.sendJSON(ws, {t: MessageType.QUERY_NODE_STATUS});
    },
    messageHandler: (ws) => {
        ws.on('message', (data) => {
            var user = p2p.sockets[p2p.sockets.indexOf(ws)].node_status ? p2p.sockets[p2p.sockets.indexOf(ws)].node_status.owner : 'unknown'
            logr.trace('P2P:', user, data)
            try {
                var message = JSON.parse(data);
            } catch(e) {
                logr.warn('Received non-JSON, doing nothing ;)')
            }
            
            switch (message.t) {
                case MessageType.QUERY_NODE_STATUS:
                    var d = {
                        origin_block: config.originHash,
                        head_block: chain.getLatestBlock()._id,
                        owner: process.env.NODE_OWNER
                    }
                    p2p.sendJSON(ws, p2p.hashAndSignMessage({t: MessageType.NODE_STATUS, d:d}))
                    break;

                case MessageType.NODE_STATUS:
                    p2p.verifySignedMessage(message, function(isValid) {
                        if (isValid)
                            p2p.sockets[p2p.sockets.indexOf(ws)].node_status = message.d
                        else
                            logr.debug('Wrong p2p sign')
                    })
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
                    var block = message.d
                    p2p.precommit(block, function() {})
                    var socket = p2p.sockets[p2p.sockets.indexOf(ws)]
                    if (!socket || !socket.node_status) return
                    p2p.sockets[p2p.sockets.indexOf(ws)].node_status.head_block = block._id
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
                case MessageType.BLOCK_PRECOMMIT:
                    var block = message.d
                    p2p.precommit(block, function() {})
                    var socket = p2p.sockets[p2p.sockets.indexOf(ws)]
                    if (!socket || !socket.node_status) return
                    for (let i = 0; i < p2p.possibleNextBlocks.length; i++) {
                        if (block.hash == p2p.possibleNextBlocks[i].block.hash
                        && p2p.possibleNextBlocks[i].pc.indexOf(socket.node_status.owner) == -1) {
                            p2p.possibleNextBlocks[i].pc.push(socket.node_status.owner)
                            p2p.consensusWorker()
                        }
                    }
                    break;
                case MessageType.BLOCK_COMMIT:
                    var block = message.d
                    p2p.precommit(block, function() {})
                    var socket = p2p.sockets[p2p.sockets.indexOf(ws)]
                    if (!socket || !socket.node_status) return
                    for (let i = 0; i < p2p.possibleNextBlocks.length; i++) {
                        if (block.hash == p2p.possibleNextBlocks[i].block.hash
                        && p2p.possibleNextBlocks[i].c.indexOf(socket.node_status.owner) == -1) {
                            p2p.possibleNextBlocks[i].c.push(socket.node_status.owner)
                            p2p.consensusWorker()
                        }
                    }
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
            && p2p.sockets[i].node_status.origin_block == config.originHash)
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
        p2p.broadcast({t:4,d:block})
    },
    hashAndSignMessage: (message) => {
        var hash = CryptoJS.SHA256(JSON.stringify(message)).toString();
        var signature = secp256k1.sign(new Buffer(hash, "hex"), bs58.decode(process.env.NODE_OWNER_PRIV));
        signature = bs58.encode(signature.signature)
        message.s = {
            n: process.env.NODE_OWNER,
            s: signature
        }
        return message
    },
    verifySignedMessage: (message, cb) => {
        var sign = message.s.s
        var name = message.s.n
        var tmpMess = message
        delete tmpMess.s
        var hash = CryptoJS.SHA256(JSON.stringify(tmpMess)).toString()
        db.collection('accounts').findOne({name: name}, function(err, account) {
            if (err) throw err;
            if (account && secp256k1.verify(
                new Buffer(hash, "hex"),
                bs58.decode(sign),
                bs58.decode(account.pub))) {
                    cb(account)
                    return
                }
        })
    },
    precommit: (block, cb) => {
        if (block._id != chain.getLatestBlock()._id+1)
            return

        for (let i = 0; i < p2p.possibleNextBlocks.length; i++)
            if (p2p.possibleNextBlocks[i].block.hash == block.hash)
                return

        chain.isValidNewBlock(block, true, function(isValid) {
            if (!isValid)
                logr.error('Received invalid new block', block)
            else {
                var possBlock = {
                    block:block,
                    pc: [block.miner],
                    c: [block.miner]
                }
                if (block.miner != process.env.NODE_OWNER)
                    possBlock.pc.push(process.env.NODE_OWNER)
        
                p2p.possibleNextBlocks.push(possBlock)
                p2p.broadcast({t:6, d:block})
                p2p.consensusWorker()
                cb()
            }
        })
    },
    commit: (block) => {
        for (let b = 0; b < p2p.possibleNextBlocks.length; b++) {
            if (p2p.possibleNextBlocks[b].block.hash == block.hash
            && p2p.possibleNextBlocks[b].c.indexOf(process.env.NODE_OWNER) == -1) {
                p2p.possibleNextBlocks[b].c.push(process.env.NODE_OWNER)
                p2p.broadcast({t:7, d:block})
                p2p.consensusWorker()
            }
        }
    },
    consensusWorker: () => {
        var activeWitnesses = []
        for (let y = 0; y < chain.schedule.shuffle.length; y++)
            if (activeWitnesses.indexOf(chain.schedule.shuffle[y].name) == -1)
                activeWitnesses.push(chain.schedule.shuffle[y].name)
            
        var connectedWitnesses = [process.env.NODE_OWNER]
        for (let i = 0; i < p2p.sockets.length; i++) {
            if (!p2p.sockets[i].node_status) continue;
            for (let y = 0; y < activeWitnesses.length; y++)
                if (activeWitnesses[y] == p2p.sockets[i].node_status.owner
                    && connectedWitnesses.indexOf(activeWitnesses[y]) == -1)
                        connectedWitnesses.push(activeWitnesses[y])
        }

        const threshold = Math.ceil(connectedWitnesses.length*2/3)
        logr.trace('CONSENSUS ',activeWitnesses,connectedWitnesses, threshold, p2p.possibleNextBlocks)
        for (let i = 0; i < p2p.possibleNextBlocks.length; i++) {
            const possBlock = p2p.possibleNextBlocks[i]
            if (possBlock.c.length >= threshold && !p2p.processing && possBlock.block._id == chain.getLatestBlock()._id+1) {
                p2p.processing = true
                logr.trace('Consensus block approved')
                chain.validateAndAddBlock(possBlock.block, function(err, newBlock) {
                    p2p.processing = false
                    if (err)
                        logr.debug('Block went through consensus but couldnt get re-validated', newBlock)
                })
                // clean up possible blocks that are in the past
                var newPossBlocks = []
                for (let y = 0; y < p2p.possibleNextBlocks.length; y++) {
                    if (possBlock.block._id < p2p.possibleNextBlocks[y].block._id)
                        newPossBlocks.push(p2p.possibleNextBlocks[y])
                }
                p2p.possibleNextBlocks = newPossBlocks
            }
            else if (possBlock.pc.length >= threshold)
                p2p.commit(possBlock.block)
            
        }
    }
}

module.exports = p2p