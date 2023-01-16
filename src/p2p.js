const version = '1.6.6'
const default_port = 6001
const replay_interval = 1500
const discovery_interval = 60000
const keep_alive_interval = 2500
const max_blocks_buffer = 100
const max_peers = process.env.MAX_PEERS || 15
const max_recover_attempts = 25
const history_interval = 10000
const keep_history_for = 20000
const p2p_port = process.env.P2P_PORT || default_port
const p2p_host = process.env.P2P_HOST || '::'
const WebSocket = require('ws')
const dns = require('dns').promises
const net = require('net')
const { randomBytes } = require('crypto')
const secp256k1 = require('secp256k1')
const bs58 = require('base-x')(config.b58Alphabet)
const blocks = require('./blocks')
const dao = require('./dao')
const daoMaster = require('./daoMaster')

const MessageType = {
    QUERY_NODE_STATUS: 0,
    NODE_STATUS: 1,
    QUERY_BLOCK: 2,
    BLOCK: 3,
    NEW_BLOCK: 4,
    NEW_TX: 5,
    BLOCK_CONF_ROUND: 6
}

let p2p = {
    sockets: [],
    recoveringBlocks: [],
    recoveredBlocks: [],
    recovering: false,
    recoverAttempt: 0,
    nodeId: null,
    init: () => {
        p2p.generateNodeId()
        let server = new WebSocket.Server({host:p2p_host, port: p2p_port})
        server.on('connection', ws => p2p.handshake(ws))
        logr.info('Listening websocket p2p port on: ' + p2p_port)
        logr.info('Version:',version)
        setTimeout(() => {
            p2p.recover()
            setInterval(() => p2p.refresh(), replay_interval)
        }, replay_interval)
        if (!process.env.NO_DISCOVERY || process.env.NO_DISCOVERY === '0' || process.env.NO_DISCOVERY === 0) {
            setInterval(function(){p2p.discoveryWorker()}, discovery_interval)
            p2p.discoveryWorker(true)
        }
        setInterval(function(){p2p.cleanRoundConfHistory()}, history_interval)
    },
    generateNodeId: () => {
        p2p.nodeId = chain.getNewKeyPair()
        logr.info('P2P ID: '+p2p.nodeId.pub)
    },
    discoveryWorker: (isInit = false) => {
        let leaders = chain.generateLeaders(false, true, config.leaders*3, 0)
        for (let i = 0; i < leaders.length; i++) {
            if (p2p.sockets.length >= max_peers) {
                logr.debug('We already have maximum peers: '+p2p.sockets.length+'/'+max_peers)
                break
            }
                
            if (leaders[i].ws) {
                let excluded = (process.env.DISCOVERY_EXCLUDE ? process.env.DISCOVERY_EXCLUDE.split(',') : [])
                if (excluded.indexOf(leaders[i].name) > -1)
                    continue
                let isConnected = false
                for (let w = 0; w < p2p.sockets.length; w++) {
                    let ip = p2p.sockets[w]._socket.remoteAddress
                    if (ip.indexOf('::ffff:') > -1)
                        ip = ip.replace('::ffff:', '')
                    try {
                        let leaderIp = leaders[i].ws.split('://')[1].split(':')[0]
                        if (leaderIp === ip) {
                            logr.trace('Already peered with '+leaders[i].name)
                            isConnected = true
                        }
                    } catch (error) {
                        logr.debug('Wrong ws for leader '+leaders[i].name+' '+leaders[i].ws, error)
                    }
                }
                if (!isConnected) {
                    logr[isInit ? 'info' : 'debug']('Trying to connect to '+leaders[i].name+' '+leaders[i].ws)
                    p2p.connect([leaders[i].ws],isInit)
                }
            }
        }
    },
    keepAlive: async () => {
        // ensure all peers explicitly listed in PEERS are connected when online
        let peers = process.env.PEERS ? process.env.PEERS.split(',') : []
        let toConnect = []
        for (let p in peers) {
            let connected = false
            let colonSplit = peers[p].replace('ws://','').split(':')
            let port = parseInt(colonSplit.pop())
            let address = colonSplit.join(':').replace('[','').replace(']','')
            if (!net.isIP(address))
                try {
                    address = (await dns.lookup(address)).address
                } catch (e) {
                    logr.debug('dns lookup failed for '+address)
                    continue
                }
            for (let s in p2p.sockets)
                if (p2p.sockets[s]._socket.remoteAddress.replace('::ffff:','') === address && p2p.sockets[s]._socket.remotePort === port) {
                    connected = true
                    break
                }
            if (!connected)
                toConnect.push(peers[p])
        }
        p2p.connect(toConnect)
        setTimeout(p2p.keepAlive,keep_alive_interval)
    },
    connect: (newPeers,isInit = false) => {
        newPeers.forEach((peer) => {
            let ws = new WebSocket(peer)
            ws.on('open', () => p2p.handshake(ws))
            ws.on('error', () => {
                logr[isInit ? 'warn' : 'debug']('peer connection failed', peer)
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
        let random = randomBytes(config.randomBytesLength).toString('hex')
        ws.challengeHash = random
        ws.pendingDisconnect = setTimeout(function() {
            for (let i = 0; i < p2p.sockets.length; i++)
                if (p2p.sockets[i].challengeHash === random) {
                    p2p.sockets[i].close()
                    logr.warn('A peer did not reply to NODE_STATUS')
                    continue
                }
        }, 1000)
        p2p.sockets.push(ws)
        p2p.messageHandler(ws)
        p2p.errorHandler(ws)
        p2p.sendJSON(ws, {
            t: MessageType.QUERY_NODE_STATUS,
            d: {
                nodeId: p2p.nodeId.pub,
                random: random
            }
        })
    },
    messageHandler: (ws) => {
        ws.on('message', (data) => {
            let message
            try {
                message = JSON.parse(data)
            } catch(e) {
                logr.warn('P2P received non-JSON, doing nothing ;)')
            }
            if (!message || typeof message.t === 'undefined') return
            if (!message.d) return
            // logr.debug('P2P-IN '+message.t)
            
            switch (message.t) {
            case MessageType.QUERY_NODE_STATUS:
                // a peer is requesting our node status
                if (typeof message.d !== 'object'
                && typeof message.d.nodeId !== 'string'
                && typeof message.d.random !== 'string')
                    return
                let wsNodeId = message.d.nodeId
                if (wsNodeId === p2p.nodeId.pub) {
                    logr.warn('Peer disconnected: same P2P ID')
                    ws.close()
                    return
                }

                p2p.sockets[p2p.sockets.indexOf(ws)].node_status = {
                    nodeId: message.d.nodeId
                }

                let sign = secp256k1.ecdsaSign(Buffer.from(message.d.random, 'hex'), bs58.decode(p2p.nodeId.priv))
                sign = bs58.encode(sign.signature)

                let d = {
                    origin_block: config.originHash,
                    head_block: chain.getLatestBlock()._id,
                    head_block_hash: chain.getLatestBlock().hash,
                    previous_block_hash: chain.getLatestBlock().phash,
                    nodeId: p2p.nodeId.pub,
                    version: version,
                    sign: sign
                }
                p2p.sendJSON(ws, {t: MessageType.NODE_STATUS, d:d})
                break

            case MessageType.NODE_STATUS:
                // we received a peer node status
                if (typeof message.d.sign === 'string') {
                    let nodeId = p2p.sockets[p2p.sockets.indexOf(ws)].node_status.nodeId
                    if (!message.d.nodeId || message.d.nodeId !== nodeId)
                        return
                    let challengeHash = p2p.sockets[p2p.sockets.indexOf(ws)].challengeHash
                    if (!challengeHash)
                        return
                    if (message.d.origin_block !== config.originHash) {
                        logr.debug('Different chain id, disconnecting')
                        return ws.close()
                    }
                    try {
                        let isValidSignature = secp256k1.ecdsaVerify(
                            bs58.decode(message.d.sign),
                            Buffer.from(challengeHash, 'hex'),
                            bs58.decode(nodeId))
                        if (!isValidSignature) {
                            logr.warn('Wrong NODE_STATUS signature, disconnecting')
                            ws.close()
                        }
                        
                        for (let i = 0; i < p2p.sockets.length; i++)
                            if (i !== p2p.sockets.indexOf(ws)
                            && p2p.sockets[i].node_status
                            && p2p.sockets[i].node_status.nodeId === nodeId) {
                                logr.debug('Peer disconnected because duplicate connections')
                                p2p.sockets[i].close()
                            }
    
                        clearInterval(p2p.sockets[p2p.sockets.indexOf(ws)].pendingDisconnect)
                        delete message.d.sign
                        p2p.sockets[p2p.sockets.indexOf(ws)].node_status = message.d
                    } catch (error) {
                        logr.error('Error during NODE_STATUS verification', error)
                    }
                }
                
                break

            case MessageType.QUERY_BLOCK:
                // a peer wants to see the data in one of our stored blocks
                if (blocks.isOpen) {
                    let block = {}
                    try {
                        block = blocks.read(message.d)
                    } catch (e) {
                        break
                    }
                    p2p.sendJSON(ws, {t:MessageType.BLOCK, d:block})
                } else
                    db.collection('blocks').findOne({_id: message.d}, function(err, block) {
                        if (err)
                            throw err
                        if (block)
                            p2p.sendJSON(ws, {t:MessageType.BLOCK, d:block})
                    })
                break

            case MessageType.BLOCK:
                // a peer sends us a block we requested with QUERY_BLOCK
                if (!message.d._id || !p2p.recoveringBlocks.includes(message.d._id)) return
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
                // we save the head_block of our peers
                // and we forward the message to consensus if we are not replaying
                if (!message.d) return
                let block = message.d

                let socket = p2p.sockets[p2p.sockets.indexOf(ws)]
                if (!socket || !socket.node_status) return
                p2p.sockets[p2p.sockets.indexOf(ws)].node_status.head_block = block._id
                p2p.sockets[p2p.sockets.indexOf(ws)].node_status.head_block_hash = block.hash
                p2p.sockets[p2p.sockets.indexOf(ws)].node_status.previous_block_hash = block.phash

                if (p2p.recovering) return
                consensus.round(0, block)
                break
                
            case MessageType.NEW_TX:
                // we received a new transaction from a peer
                if (p2p.recovering) return
                let tx = message.d

                // if the pool is already full, do nothing at all
                if (transaction.isPoolFull())
                    break

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
                if (p2p.recovering) return
                if (!message.s || !message.s.s || !message.s.n) return
                if (!message.d || !message.d.ts || 
                    typeof message.d.ts != 'number' ||
                    message.d.ts + 2*config.blockTime < new Date().getTime() ||
                    message.d.ts - 2*config.blockTime > new Date().getTime()) return

                logr.cons(message.s.n+' U-R'+message.d.r)

                if (p2p.sockets[p2p.sockets.indexOf(ws)]) {
                    if (!p2p.sockets[p2p.sockets.indexOf(ws)].sentUs)
                        p2p.sockets[p2p.sockets.indexOf(ws)].sentUs = []
                    p2p.sockets[p2p.sockets.indexOf(ws)].sentUs.push([message.s.s,new Date().getTime()])
                }

                for (let i = 0; i < consensus.processed.length; i++) {
                    if (consensus.processed[i][1] + 2*config.blockTime < new Date().getTime()) {
                        consensus.processed.splice(i, 1)
                        i--
                        continue
                    }
                    if (consensus.processed[i][0].s.s === message.s.s)
                        return
                }
                consensus.processed.push([message, new Date().getTime()])

                consensus.verifySignature(message, function(isValid) {
                    if (!isValid && !p2p.recovering) {
                        logr.warn('Received wrong consensus signature', message)
                        return
                    }

                    // bounce the message to peers
                    p2p.broadcastNotSent(message)

                    // always try to precommit in case its the first time we see it
                    consensus.round(0, message.d.b, function(validationStep) {
                        if (validationStep === -1) {
                            // logr.trace('Ignored BLOCK_CONF_ROUND')
                        } else if (validationStep === 0) {
                            // block is being validated, we queue the message
                            consensus.queue.push(message)
                            logr.debug('Added to queue')
                        } else
                            // process the message inside the consensus
                            consensus.remoteRoundConfirm(message)
                    })
                })
                break
            }
        })
    },
    recover: () => {
        if (!p2p.sockets || p2p.sockets.length === 0) return
        if (Object.keys(p2p.recoveredBlocks).length + p2p.recoveringBlocks.length > max_blocks_buffer) return
        if (!p2p.recovering) p2p.recovering = chain.getLatestBlock()._id
        
        let peersAhead = []
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i].node_status 
            && p2p.sockets[i].node_status.head_block > chain.getLatestBlock()._id
            && p2p.sockets[i].node_status.origin_block === config.originHash)
                peersAhead.push(p2p.sockets[i])

        if (peersAhead.length === 0) {
            p2p.recovering = false
            return
        }

        let champion = peersAhead[Math.floor(Math.random()*peersAhead.length)]
        if (p2p.recovering+1 <= champion.node_status.head_block) {
            p2p.recovering++
            p2p.sendJSON(champion, {t: MessageType.QUERY_BLOCK, d:p2p.recovering})
            p2p.recoveringBlocks.push(p2p.recovering)
            logr.debug('query block #'+p2p.recovering+' -- head block: '+champion.node_status.head_block)
            if (p2p.recovering%2) p2p.recover()
        }
    },
    refresh: (force = false) => {
        if (p2p.recovering && !force) return
        for (let i = 0; i < p2p.sockets.length; i++)
            if (p2p.sockets[i].node_status 
            && p2p.sockets[i].node_status.head_block > chain.getLatestBlock()._id + 10
            && p2p.sockets[i].node_status.origin_block === config.originHash) {
                logr.info('Catching up with network, head block: ' + p2p.sockets[i].node_status.head_block)
                p2p.recovering = chain.getLatestBlock()._id
                p2p.recover()
                break
            }
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
            let data = JSON.stringify(d)
            // logr.debug('P2P-OUT:', d.t)
            ws.send(data)
        } catch (error) {
            logr.warn('Tried sending p2p message and failed')
        }
        
    },
    broadcastNotSent: (d) => {
        firstLoop:
        for (let i = 0; i < p2p.sockets.length; i++) {
            if (!p2p.sockets[i].sentUs) {
                p2p.sendJSON(p2p.sockets[i], d)
                continue
            }
            for (let y = 0; y < p2p.sockets[i].sentUs.length; y++) 
                if (p2p.sockets[i].sentUs[y][0] === d.s.s)
                    continue firstLoop
            p2p.sendJSON(p2p.sockets[i], d)
        }
    },
    broadcast: (d) => p2p.sockets.forEach(ws => p2p.sendJSON(ws, d)),
    broadcastBlock: (block) => {
        p2p.broadcast({t:4,d:block})
    },
    addRecursive: (block) => {
        chain.validateAndAddBlock(block, true, function(err, newBlock) {
            if (err) {
                // try another peer if bad block
                cache.rollback()
                dao.resetID()
                daoMaster.resetID()
                p2p.recoveredBlocks = []
                p2p.recoveringBlocks = []
                p2p.recoverAttempt++
                if (p2p.recoverAttempt > max_recover_attempts)
                    logr.error('Error Replay', newBlock._id)
                else {
                    logr.warn('Recover attempt #'+p2p.recoverAttempt+' for block '+newBlock._id)
                    p2p.recovering = chain.getLatestBlock()._id
                    p2p.recover()
                }
            } else {
                p2p.recoverAttempt = 0
                delete p2p.recoveredBlocks[newBlock._id]
                p2p.recover()
                if (p2p.recoveredBlocks[chain.getLatestBlock()._id+1]) 
                    setTimeout(function() {
                        if (p2p.recoveredBlocks[chain.getLatestBlock()._id+1])
                            p2p.addRecursive(p2p.recoveredBlocks[chain.getLatestBlock()._id+1])
                    }, 1)
            }     
        })
    },
    cleanRoundConfHistory: () => {
        logr.trace('Cleaning old p2p messages history')
        for (let i = 0; i < p2p.sockets.length; i++) {
            if (!p2p.sockets[i].sentUs)
                continue
            for (let y = 0; y < p2p.sockets[i].sentUs.length; y++)
                if (new Date().getTime() - p2p.sockets[i].sentUs[y][1] > keep_history_for) {
                    p2p.sockets[i].sentUs.splice(y,1)
                    y--
                }
        }
    }
}

module.exports = p2p
