module.exports = {
    init: (app) => {
        // account history api
        app.get('/history/:author/:lastBlock/:skip?', (req, res) => {
            let lastBlock = parseInt(req.params.lastBlock)
            let skip = parseInt(req.params.skip)
            let author = req.params.author
            let query = {
                $and: [
                    { $or: [
                        {'txs.sender': author},
                        {'txs.data.target': author},
                        {'txs.data.receiver': author},
                        {'txs.data.pa': author},
                        {'txs.data.author': author}
                    ]}
                ]
            }
            let filter = {
                sort: {_id: -1},
                limit: 50
            }
    
            if (lastBlock > 0) 
                query['$and'].push({_id: {$lt: lastBlock}})
            
            if (!isNaN(skip) && skip > 0)
                filter.skip = skip
    
            db.collection('blocks').find(query, filter).toArray(function(err, blocks) {
                if (err || !blocks)
                    return res.status(500).send({error: 'failed to query blocks for account history'})
                for (let b = 0; b < blocks.length; b++) {
                    let newTxs = []
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
