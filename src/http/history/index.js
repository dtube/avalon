module.exports = {
    init: (app) => {
        /**
         * @api {get} /history/:author/:lastBlock/:skip? Account History
         * @apiName accountHistory
         * @apiGroup Accounts
         * 
         * @apiParam {String} author Username to retrieve account history of
         * @apiParam {Integer} lastBlock Lastest block the transaction is included into
         * @apiParam {Integer} [skip] Account history items to skip for pagination
         * 
         * @apiSuccess {Object[]} transactions List of transactions sent or received by the account
         */
        app.get('/history/:author/:lastBlock/:skip?', (req, res) => {
            let lastBlock = parseInt(req.params.lastBlock)
            let skip = parseInt(req.params.skip)
            let author = req.params.author

            if (process.env.TX_HISTORY === '1') {
                let query = {
                    $and: [
                        { $or: [
                            {'sender': author},
                            {'data.target': author},
                            {'data.receiver': author},
                            {'data.pa': author},
                            {'data.author': author}
                        ]}
                    ]
                }
                let filter = {
                    sort: {includedInBlock: -1},
                    limit: 50
                }
        
                if (lastBlock > 0) 
                    query['$and'].push({includedInBlock: {$lt: lastBlock}})
                
                if (!isNaN(skip) && skip > 0)
                    filter.skip = skip
        
                db.collection('txs').find(query, filter).toArray(function(err, txs) {
                    if (err || !txs)
                        return res.status(500).send({error: 'failed to query account history'})
                    for (let t = 0; t < txs.length; t++)
                        delete txs[t]._id
                    res.send(txs)
                })
                return
            }

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
