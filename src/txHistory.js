const cloneDeep = require('clone-deep')

let txHistory = {
    indexQueue: [],
    accounts: process.env.TX_HISTORY_ACCOUNTS ? process.env.TX_HISTORY_ACCOUNTS.split(',') : [],
    processBlock: (block) => {
        if (process.env.TX_HISTORY !== '1') return
        for (let t in block.txs)
            if (txHistory.accounts.length === 0 ||
                txHistory.accounts.includes(block.txs[t].sender) ||
                txHistory.accounts.includes(block.txs[t].data.target) ||
                txHistory.accounts.includes(block.txs[t].data.receiver) ||
                txHistory.accounts.includes(block.txs[t].data.pa) ||
                txHistory.accounts.includes(block.txs[t].data.author)) {
                let newTxItm = cloneDeep(block.txs[t])
                newTxItm._id = newTxItm.hash
                newTxItm.includedInBlock = block._id
                txHistory.indexQueue.push(newTxItm)
            }
    },
    getWriteOps: () => {
        if (process.env.TX_HISTORY !== '1') return []
        let ops = []
        for (let i in txHistory.indexQueue) {
            let newTx = txHistory.indexQueue[i]
            ops.push((cb) => db.collection('txs').insertOne(newTx,cb))
        }
        txHistory.indexQueue = []
        return ops
    }
}

module.exports = txHistory