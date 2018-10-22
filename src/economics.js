var GrowInt = require('./growInt.js')
var DecayInt = require('./decayInt.js')

var eco = {
    activeUsersCount: (cb) => {
        // we consider anyone with a non zero balance to be active, otherwise he loses out
        db.collection('accounts').find({balance: {$gt: 0}}).count(function(err, count) {
            if (err) throw err;
            cb(count)
        })
    },
    totalSupply: (cb) => {
        db.collection('accounts').aggregate([
            {$match: {}},
            {
                $group: {
                    _id: null,
                    count: {
                        $sum:"$balance"
                    }
                }
            }
        ]).toArray(function(err, res) {
            if (err) throw err;
            cb(res)
        })
    },
    theoricalRewardPool: (cb) => {
        eco.activeUsersCount(function(activeUsers) {
            // will need tuning for different experiments
            cb(activeUsers)
        })
    },
    rewardPool: (cb) => {
        // 1200 blocks ~= 1 hour
        // this might need to get reduced in the future as volume grows
        eco.theoricalRewardPool(function(theoricalPool){
            db.collection('blocks').find({}, {sort: {_id:-1}, limit: 1200}).toArray(function(err, blocks) {
                var rewardPool = theoricalPool
                var burned = 0
                var distributed = 0
                var votes = 0
                for (let i = 0; i < blocks.length; i++) {
                    if (blocks[i].burn)
                        burned += blocks[i].burn
                    if (blocks[i].dist)
                        distributed += blocks[i].dist
                    
                    for (let y = 0; y < blocks[i].txs.length; y++) {
                        var tx = blocks[i].txs[y]
                        if (tx.type == 5)
                            votes += Math.abs(tx.data.vt)
                    }
                }
                cb({
                    theo: theoricalPool,
                    burn: burned,
                    dist: distributed,
                    votes: votes,
                    avail: theoricalPool+burned-distributed
                })
            })
        })
    },
    distribute: (name, vt, ts, cb) => {
        eco.rewardPool(function(stats) {
            db.collection('accounts').findOne({name: name}, function(err, account) {
                if (err) throw err;
                if (!account.uv) account.uv = 0
                var thNewCoins = stats.avail * Math.abs((vt+account.uv) / (Math.abs(vt)+stats.votes))
                var newCoins = Math.floor(thNewCoins)
                
                // make sure one person cant empty the whole pool
                // eg stats.votes = 0
                if (newCoins > Math.floor(stats.avail/2))
                    newCoins = Math.floor(stats.avail/2)

                if (vt<0) newCoins *= -1

                // calculate unpaid votes and keep them for the next distribute()
                var unpaidVotes = (thNewCoins-newCoins)
                unpaidVotes /= stats.avail
                unpaidVotes *= (vt+stats.votes)
                if (vt<0) unpaidVotes = Math.ceil(unpaidVotes)
                else unpaidVotes = Math.floor(unpaidVotes)

                //console.log(newCoins, unpaidVotes)

                // make the reservoir flow into balance
                var newPr = new DecayInt(account.pr, {halflife:1000*60*60*24}).decay(ts)
                var newBalance = account.balance + account.pr.v - newPr.v
                newPr.v += newCoins
                if (newPr.v < 0) newPr.v = 0
                
                db.collection('accounts').updateOne({name: name}, {
                    $set: {
                        pr: newPr,
                        balance: newBalance,
                        uv: unpaidVotes
                    }
                }).then(function(){
                    cb(newCoins)
                })
            })
        })
    }
} 

module.exports = eco