module.exports = {
    init: (app) => {
        // account history api
        app.get('/history/:author/:lastBlock', (req, res) => {
            var lastBlock = parseInt(req.params.lastBlock)
            var author = req.params.author
            var query = {
                $and: [
                    {
                        $or: [
                            { 'txs.sender': author },
                            { 'txs.data.target': author },
                            { 'txs.data.receiver': author },
                            { 'txs.data.pa': author },
                            { 'txs.data.author': author }
                        ]
                    }
                ]
            }
            if (lastBlock > 0)
                query['$and'].push({ _id: { $lt: lastBlock } })

            db.collection('blocks').find(query, { sort: { _id: -1 }, limit: 50 }).toArray(function (err, blocks) {
                for (let b = 0; b < blocks.length; b++) {
                    var newTxs = []
                    for (let t = 0; t < blocks[b].txs.length; t++)
                        if (blocks[b].txs[t].sender === author
                            || blocks[b].txs[t].data.target === author
                            || blocks[b].txs[t].data.receiver === author
                            || blocks[b].txs[t].data.pa === author
                            || blocks[b].txs[t].data.author === author)
                            newTxs.push(blocks[b].txs[t])
                    blocks[b].txs = newTxs
                }
                res.send(blocks)
            })
        })
    }
}
