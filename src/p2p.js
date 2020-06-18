const default_port = 6001
const replay_interval = 1500
const discovery_interval = 3000
const max_blocks_buffer = 100
const max_peers = process.env.MAX_PEERS || 10
var p2p_port = process.env.P2P_PORT || default_port
var WebSocket = require('ws')
var chain = require('./chain.js')
var consensus = require('./consensus.js')

var MessageType = {
    QUERY_NODE_STATUS: 0,
    NODE_STATUS: 1,
    QUERY_BLOCK: 2,
    BLOCK: 3,
    NEW_BLOCK: 4,
    NEW_TX: 5,
    BLOCK_CONF_ROUND: 6
}

var p2p = {
    sockets: [],
    recoveringBlocks: [],
    recoveredBlocks: [],
    recovering: false,
    discoveryWorker: () => {
        chain.generateLeaders(false, config.leaders*3, function(leaders) {
            for (let i = 0; i < leaders.length; i++) {
                if (p2p.sockets.length >= max_peers) {
                    logr.debug('We already have maximum peers: '+p2p.sockets.length+'/'+max_peers)
                    break
                }
                    
                if (leaders[i].json && leaders[i].json.node && leaders[i].json.node.ws) {
                    var excluded = (process.env.DISCOVERY_EXCLUDE ? process.env.DISCOVERY_EXCLUDE.split(',') : [])
                    if (excluded.indexOf(leaders[i].name))
                        continue
                    var isConnected = false
                    for (let w = 0; w < p2p.sockets.length; w++) {
                        var ip = p2p.sockets[w]._socket.remoteAddress
                        if (ip.indexOf('::ffff:') > -1)
                            ip = ip.replace('::ffff:', '')
                        
                        try {
                            var leaderIp = leaders[i].json.node.ws.split('://')[1].split(':')[0]
                            if (leaderIp === ip) {
                                logr.debug('Already peered with '+leaders[i].name)
                                isConnected = true
                            }
                                
                            break
                        } catch (error) {
                            logr.warn('Wrong json.node.ws for leader '+leaders[i].name+' '+leaders[i].json.node.ws, error)
                        }
                    }
                    if (!isConnected) {
                        logr.info('Trying to connect to '+leaders[i].name+' '+leaders[i].json.node.ws)
                        p2p.connect([leaders[i].json.node.ws])
                    }
                }
            }
        })
    },
    init: () => {
        var server = new WebSocket.Server({port: p2p_port})
        server.on('connection', ws => p2p.handshake(ws))
        logr.info('Listening websocket p2p port on: ' + p2p_port)
        setTimeout(function(){p2p.recover()}, replay_interval)
        if (!process.env.NO_DISCOVERY) {
            setInterval(function(){p2p.discoveryWorker()}, discovery_interval)
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
        })
    },
    handshake: (ws) => {
        if (process.env.OFFLINE) {
            logr.warn('Incoming handshake refused because OFFLINE')
            ws.close(); return
        }
        if (p2p.sockets.length >= max_peers) {
            logr.warn('Incoming handshake refused because already peered enough '+p2p.sockets.length+'/'+max_peers)
            ws.close(); return
        }
        // close connection if we already have this peer ip in our connected sockets
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i]._socket.remoteAddress === ws._socket.remoteAddress
                && p2p.sockets[i]._socket.remotePort === ws._socket.remotePort) {
                ws.close()
                return
            }
        logr.debug('Handshaking new peer', ws.url || ws._socket.remoteAddress+':'+ws._socket.remotePort)
        p2p.sockets.push(ws)
        p2p.messageHandler(ws)
        p2p.errorHandler(ws)
        p2p.sendJSON(ws, {t: MessageType.QUERY_NODE_STATUS})
    },
    messageHandler: (ws) => {
        ws.on('message', (data) => {
            try {
                var message = JSON.parse(data)
            } catch(e) {
                logr.warn('P2P received non-JSON, doing nothing ;)')
            }
            if (!message || typeof message.t === 'undefined') return
            if (!message.d && message.t !== MessageType.QUERY_NODE_STATUS) return
            // logr.debug('P2P-IN '+message.t)
            
            switch (message.t) {
            case MessageType.QUERY_NODE_STATUS:
                // a peer is requesting our node status
                var d = {
                    origin_block: config.originHash,
                    head_block: chain.getLatestBlock()._id,
                    head_block_hash: chain.getLatestBlock().hash,
                    previous_block_hash: chain.getLatestBlock().phash
                }
                p2p.sendJSON(ws, {t: MessageType.NODE_STATUS, d:d})
                break

            case MessageType.NODE_STATUS:
                // we received a peer node status
                p2p.sockets[p2p.sockets.indexOf(ws)].node_status = message.d
                break

            case MessageType.QUERY_BLOCK:
                // a peer wants to see the data in one of our stored blocks
                db.collection('blocks').findOne({_id: message.d}, function(err, block) {
                    if (err)
                        throw err
                    if (block)
                        p2p.sendJSON(ws, {t:MessageType.BLOCK, d:block})
                })
                break

            case MessageType.BLOCK:
                // a peer sends us a block we requested with QUERY_BLOCK
                for (let i = 0; i < p2p.recoveringBlocks.length; i++)
                    if (p2p.recoveringBlocks[i] === message.d._id) {
                        p2p.recoveringBlocks.splice(i, 1)
                        break
                    }
                            
                if (chain.getLatestBlock()._id+1 === message.d._id)
                    p2p.addRecursive(message.d)
                else {
                    p2p.recoveredBlocks[message.d._id] = message.d
                    p2p.recover()
                }
                break

            case MessageType.NEW_BLOCK:
                // we received a new block we didn't request from a peer
                // we forward it to consensus
                var block = message.d
                consensus.round(0, block)
                break
                
            case MessageType.NEW_TX:
                // we received a new transaction from a peer
                var tx = message.d

                // if its already in the mempool, it means we already handled it
                if (transaction.isInPool(tx))
                    break
                
                transaction.isValid(tx, new Date().getTime(), function(isValid) {
                    if (isValid) {
                        // if its valid we add it to mempool and broadcast it to our peers
                        transaction.addToPool([tx])
                        p2p.broadcast({t:5, d:tx})
                    } 
                    
                })
                break

            case MessageType.BLOCK_CONF_ROUND:
                // we are receiving a consensus round confirmation
                // it should come from one of the elected leaders, so let's verify signature
                if (!message.s || !message.s.s || !message.s.n) return
                // logr.debug(message.s.n+' U'+message.d.r)

                // if (!p2p.sockets[p2p.sockets.indexOf(ws)]) throw err
                // if (!p2p.sockets[p2p.sockets.indexOf(ws)].sentUs)
                //     p2p.sockets[p2p.sockets.indexOf(ws)].sentUs = []
                // p2p.sockets[p2p.sockets.indexOf(ws)].sentUs.push(message.s.s)

                // always try to precommit in case its the first time we see it
                consensus.round(0, message.d.b, function(validationStep) {
                    if (validationStep === -1) {
                        // logr.trace('Ignored BLOCK_CONF_ROUND')
                    } else if (validationStep === 0) {
                        // block is being validated, we queue the message
                        consensus.queue.push(message)
                        logr.debug('Added to queue')
                    } else {
                        // process the message inside the consensus
                        consensus.remoteRoundConfirm(message)
                    }
                })
                break
            }
        })
    },
    recover: () => {
        if (!p2p.sockets || p2p.sockets.length === 0) return
        if (Object.keys(p2p.recoveredBlocks).length + p2p.recoveringBlocks.length > max_blocks_buffer) return
        if (!p2p.recovering) p2p.recovering = chain.getLatestBlock()._id
        
        p2p.recovering++
        var peersAhead = []
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i].node_status 
            && p2p.sockets[i].node_status.head_block > chain.getLatestBlock()._id
            && p2p.sockets[i].node_status.origin_block === config.originHash)
                peersAhead.push(p2p.sockets[i])

        if (peersAhead.length === 0) {
            p2p.recovering = false
            return
        }

        var champion = peersAhead[Math.floor(Math.random()*peersAhead.length)]
        p2p.sendJSON(champion, {t: MessageType.QUERY_BLOCK, d:p2p.recovering})
        p2p.recoveringBlocks.push(p2p.recovering)

        if (p2p.recovering%2) p2p.recover()
    },
    errorHandler: (ws) => {
        ws.on('close', () => p2p.closeConnection(ws))
        ws.on('error', () => p2p.closeConnection(ws))
    },
    closeConnection: (ws) => {
        p2p.sockets.splice(p2p.sockets.indexOf(ws), 1)
        logr.debug('a peer disconnected, '+p2p.sockets.length+' peers left')
    },
    sendJSON: (ws, d) => {
        try {
            var data = JSON.stringify(d)
            // logr.debug('P2P-OUT:', d.t)
            ws.send(data)
        } catch (error) {
            logr.warn('Tried sending p2p message and failed')
        }
        
    },
    broadcast: (d) => p2p.sockets.forEach(ws => p2p.sendJSON(ws, d)),
    broadcastBlock: (block) => {
        p2p.broadcast({t:4,d:block})
    },
    addRecursive: (block) => {
        chain.validateAndAddBlock(block, true, function(err, newBlock) {
            if (err)
                logr.error('Error Replay', newBlock)
            else {
                delete p2p.recoveredBlocks[newBlock._id]
                p2p.recover()
                if (p2p.recoveredBlocks[chain.getLatestBlock()._id+1]) 
                    setTimeout(function() {
                        p2p.addRecursive(p2p.recoveredBlocks[chain.getLatestBlock()._id+1])
                    }, 1)
            }     
        })
    }
}

module.exports = p2p