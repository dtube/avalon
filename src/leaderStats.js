// leader indexer from extended api
let indexer = {
    leaders: {
        dtube: {
            sinceTs: 0,
            sinceBlock: 0,
            produced: 1,
            missed: 0,
            voters: 1, // genesis
            last: 0
        }
    },
    updates: {
        leaders: []
    },
    processBlock: (block) => {
        if (process.env.LEADER_STATS !== '1') return
        if (!block)
            throw new Error('cannot process undefined block')

        // Setup new leader accounts
        if (!indexer.leaders[block.miner])
            indexer.leaders[block.miner] = {
                produced: 0,
                missed: 0,
                voters: 0,
                last: 0
            }
        if (block.missedBy && !indexer.leaders[block.missedBy])
            indexer.leaders[block.missedBy] = {
                produced: 0,
                missed: 0,
                voters: 0,
                last: 0
            }

        // Increment produced/missed
        indexer.leaders[block.miner].produced += 1
        indexer.leaders[block.miner].last = block._id
        if (block.missedBy) indexer.leaders[block.missedBy].missed += 1

        // Record first time producers whenever applicable
        if (!indexer.leaders[block.miner].sinceTs) indexer.leaders[block.miner].sinceTs = block.timestamp
        if (!indexer.leaders[block.miner].sinceBlock) indexer.leaders[block.miner].sinceBlock = block._id

        // Leader updates
        if (!indexer.updates.leaders.includes(block.miner))
            indexer.updates.leaders.push(block.miner)

        if (block.missedBy && !indexer.updates.leaders.includes(block.missedBy))
            indexer.updates.leaders.push(block.missedBy)

        // Look for approves/disapproves in tx
        for (let i = 0; i < block.txs.length; i++)
            if (block.txs[i].type === 1) {
                // APPROVE_NODE_OWNER
                if (!indexer.leaders[block.txs[i].data.target]) indexer.leaders[block.txs[i].data.target] = {
                    produced: 0,
                    missed: 0,
                    voters: 0,
                    last: 0
                }
                indexer.leaders[block.txs[i].data.target].voters += 1
                if (!indexer.updates.leaders.includes(block.txs[i].data.target))
                    indexer.updates.leaders.push(block.txs[i].data.target)
            } else if (block.txs[i].type === 2) {
                // DISAPPROVE_NODE_OWNER
                if (!indexer.leaders[block.txs[i].data.target]) indexer.leaders[block.txs[i].data.target] = {
                    produced: 0,
                    missed: 0,
                    voters: 0,
                    last: 0
                }
                indexer.leaders[block.txs[i].data.target].voters -= 1
                if (!indexer.updates.leaders.includes(block.txs[i].data.target))
                    indexer.updates.leaders.push(block.txs[i].data.target)
            } else if (block.txs[i].type === 18 && !indexer.leaders[block.txs[i].sender]) {
                // ENABLE_NODE
                indexer.leaders[block.txs[i].sender] = {
                    produced: 0,
                    missed: 0,
                    voters: 0,
                    last: 0
                }
                if (!indexer.updates.leaders.includes(block.txs[i].sender))
                    indexer.updates.leaders.push(block.txs[i].sender)
            }
    },
    getWriteOps: () => {
        if (process.env.LEADER_STATS !== '1') return []
        let ops = []
        for (let acc in indexer.updates.leaders) {
            let updatedLeader = indexer.updates.leaders[acc]
            ops.push((cb) => db.collection('leaders').updateOne({_id: updatedLeader },{
                $set: indexer.leaders[updatedLeader]
            },{ upsert: true },() => cb(null,true)))
        }
        indexer.updates.leaders = []
        return ops
    },
    loadIndex: () => {
        return new Promise((rs,rj) => {
            if (process.env.LEADER_STATS !== '1') return rs()
            db.collection('leaders').find({},{}).toArray((e,leaders) => {
                if (e) return rj(e)
                if (leaders) for (let i in leaders) {
                    indexer.leaders[leaders[i]._id] = leaders[i]
                    delete indexer.leaders[leaders[i]._id]._id
                }
                rs()
            })
        })
    }
}

module.exports = indexer