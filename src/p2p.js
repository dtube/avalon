const default_port = 6001
const replay_interval = 1500
const discovery_interval = 60000
const max_blocks_buffer = 100
var p2p_port = process.env.P2P_PORT || default_port
var replay_pub = process.env.REPLAY_PUB
var WebSocket = require('ws')
var chain = require('./chain.js')
var secp256k1 = require('secp256k1')
var bs58 = require('base-x')(config.b58Alphabet)
var CryptoJS = require('crypto-js')
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
        chain.generateLeaders(function(miners) {
            for (let i = 0; i < miners.length; i++) {
                if (miners[i].name === process.env.NODE_OWNER) continue
                if (!miners[i].json) continue

                // are we already connected?
                var connected = false
                for (let y = 0; y < p2p.sockets.length; y++) {
                    if (!p2p.sockets[y] || !p2p.sockets[y].node_status) continue
                    if (miners[i].name === p2p.sockets[y].node_status.owner)
                        connected = true
                }

                if (!connected) {
                    var json = miners[i].json
                    if (json.node && json.node.ws) 
                        p2p.connect([json.node.ws])
                    
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
        if (process.env.NO_DISCOVERY && p2p.sockets.length >= process.env.PEERS.split(',').length) {
            logr.warn('Incoming handshake refused because in NO_DISCOVERY mode and already peered enough')
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
            //var user = p2p.sockets[p2p.sockets.indexOf(ws)].node_status ? p2p.sockets[p2p.sockets.indexOf(ws)].node_status.owner : 'unknown'
            //logr.trace('P2P-IN:', user, data)
            try {
                var message = JSON.parse(data)
            } catch(e) {
                logr.warn('Received non-JSON, doing nothing ;)')
            }
            if (!message || !message.t) return
            
            switch (message.t) {
            case MessageType.QUERY_NODE_STATUS:
                var d = {
                    origin_block: config.originHash,
                    head_block: chain.getLatestBlock()._id,
                    head_block_hash: chain.getLatestBlock().hash,
                    previous_block_hash: chain.getLatestBlock().phash,
                    owner: process.env.NODE_OWNER
                }
                var signedMessage = p2p.hashAndSignMessage({t: MessageType.NODE_STATUS, d:d})
                p2p.sendJSON(ws, signedMessage)
                break

            case MessageType.NODE_STATUS:
                p2p.verifySignedMessage(message, function(isValid) {
                    if (isValid)
                        p2p.sockets[p2p.sockets.indexOf(ws)].node_status = message.d
                    else
                        logr.debug('Wrong p2p sign')
                })
                break

            case MessageType.QUERY_BLOCK:
                db.collection('blocks').findOne({_id: message.d}, function(err, block) {
                    if (err)
                        throw err
                    if (block)
                        p2p.sendJSON(ws, {t:MessageType.BLOCK, d:block})
                })
                break

            case MessageType.BLOCK:
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
                var socket = p2p.sockets[p2p.sockets.indexOf(ws)]
                if (!socket || !socket.node_status) return
                var block = message.d
                consensus.round(0, block)
                p2p.sockets[p2p.sockets.indexOf(ws)].node_status.head_block = block._id
                p2p.sockets[p2p.sockets.indexOf(ws)].node_status.head_block_hash = block.hash
                p2p.sockets[p2p.sockets.indexOf(ws)].node_status.previous_block_hash = block.phash
                break
            case MessageType.NEW_TX:
                var tx = message.d
                transaction.isValid(tx, new Date().getTime(), function(isValid) {
                    if (isValid && !transaction.isInPool(tx)) {
                        transaction.addToPool([tx])
                        p2p.broadcast({t:5, d:tx})
                    } 
                    
                })
                break

            case MessageType.BLOCK_CONF_ROUND:
                // we are receiving a consensus round confirmation
                var leader = p2p.sockets[p2p.sockets.indexOf(ws)]
                if (!leader || !leader.node_status) return

                // always try to precommit in case its the first time we see it
                consensus.round(0, message.d.b)

                // process the message inside the consensus
                consensus.messenger(leader, message.d.r, message.d.b)
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
            var user = p2p.sockets[p2p.sockets.indexOf(ws)].node_status ? p2p.sockets[p2p.sockets.indexOf(ws)].node_status.owner : 'unknown'
            var data = JSON.stringify(d)
            //logr.trace('P2P-OUT:', user, data)
            ws.send(data)
        } catch (error) {
            logr.warn('Tried sending p2p message and failed')
        }
        
    },
    broadcast: (d) => p2p.sockets.forEach(ws => p2p.sendJSON(ws, d)),
    broadcastBlock: (block) => {
        p2p.broadcast({t:4,d:block})
    },
    hashAndSignMessage: (message) => {
        var hash = CryptoJS.SHA256(JSON.stringify(message)).toString()
        var signature = secp256k1.sign(Buffer.from(hash, 'hex'), bs58.decode(process.env.NODE_OWNER_PRIV))
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
            if (err) throw err
            if (!account && replay_pub && secp256k1.verify(
                Buffer.from(hash, 'hex'),
                bs58.decode(sign),
                bs58.decode(replay_pub))) {
                cb(true)
                return
            }
            if (account && secp256k1.verify(
                Buffer.from(hash, 'hex'),
                bs58.decode(sign),
                bs58.decode(account.pub))) {
                cb(account)
                return
            }
        })
    },
    addRecursive: (block) => {
        chain.validateAndAddBlock(block, true, function(err, newBlock) {
            // if (newBlock._id == 6465) {
            //     process.exit(0)
            // }
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