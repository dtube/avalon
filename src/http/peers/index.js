module.exports = {
    init: (app) => {
        // list connected peers
        app.get('/peers', (req, res) => {
            let peers = []
            for (let i = 0; i < p2p.sockets.length; i++) {
                let peer = {
                    ip: p2p.sockets[i]._socket.remoteAddress,
                    port: p2p.sockets[i]._socket.remotePort,
                }
                if (p2p.sockets[i].node_status)
                    peer.node_status = p2p.sockets[i].node_status

                peers.push(peer)
            }
            res.send(peers)
        })
    }
}
