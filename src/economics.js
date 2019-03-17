var GrowInt = require('./growInt.js')
var DecayInt = require('./decayInt.js')
const series = require('run-series')

var eco = {
    currentBlock: {
        dist: 0,
        burn: 0,
        votes: 0
    },
    nextBlock: () => {
        eco.currentBlock.dist = 0
        eco.currentBlock.burn = 0
        eco.currentBlock.votes = 0
    },
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
                    burn: burned + eco.currentBlock.burn,
                    dist: distributed + eco.currentBlock.dist,
                    votes: votes + eco.currentBlock.votes,
                    avail: theoricalPool - distributed - eco.currentBlock.dist
                })
            })
        })
    },
    curation: (author, link, cb) => {
        db.collection('contents').findOne({author: author, link: link}, function(err, content) {
            var firstVote = content.votes[0]
            var sumVt = 0
            // first loop to calculate the vp per day of each upvote
            for (let i = 0; i < content.votes.length; i++) {
                if (content.votes[i].ts == firstVote.ts) {
                    content.votes[i].vpPerDayBefore = 0
                } else {
                    var dayDiff = (content.votes[i].ts - firstVote.ts) / (1000*60*60*24)
                    content.votes[i].vpPerDayBefore = sumVt/dayDiff
                }
                sumVt += content.votes[i].vt
            }

            var currentVote = content.votes[content.votes.length-1]
            var winners = []
            sumVt = 0

            logr.trace('Votes:', content.votes)

            // second loop to filter winners (same vote direction and vpPerDay lower than current one)
            for (let i = 0; i < content.votes.length-1; i++) {
                if (content.votes[i].vt * currentVote.vt > 0) {
                    if (currentVote.vt > 0 && content.votes[i].vpPerDayBefore < currentVote.vpPerDayBefore) {
                        sumVt += content.votes[i].vt
                        winners.push(content.votes[i])
                    }
                    if (currentVote.vt < 0 && content.votes[i].vpPerDayBefore > currentVote.vpPerDayBefore) {
                        sumVt += content.votes[i].vt
                        winners.push(content.votes[i])
                    }
                }
            }

            // third loop to calculate each winner shares
            for (let i = 0; i < winners.length; i++)
                winners[i].share = winners[i].vt / sumVt

            winners.sort(function(a,b) {
                return b.share - a.share
            })

            logr.trace('WINNERS:', winners)

            // forth loop to pay out
            var executions = []
            for (let i = 0; i < winners.length; i++) {
                executions.push(function(callback) {
                    var payout = Math.floor(winners[i].share * Math.abs(currentVote.vt))
                    if (payout < 0) {
                        throw 'Fatal distribution error (negative payout)'
                    }
                    if (payout == 0) {
                        callback(null, 0)
                        return
                    }
                    eco.distribute(winners[i].u, payout, currentVote.ts, function(dist) {
                        eco.currentBlock.dist += dist
                        eco.currentBlock.votes += payout
                        callback(null, dist)
                    })
                })
            }
            series(executions, function(err, results) {
                if (err) throw err;
                var newCoins = 0
                for (let r = 0; r < results.length; r++)
                    newCoins += results[r];
                db.collection('contents').updateOne({author: author, link: link}, {
                    $inc: {dist: newCoins}
                }).then(function() {
                    cb(newCoins)
                })
            })
        })
    },
    distribute: (name, vt, ts, cb) => {
        eco.rewardPool(function(stats) {
            cache.findOne('accounts', {name: name}, function(err, account) {
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
                var changes = {
                    uv: unpaidVotes
                }

                if (newCoins > 0) {
                    // option 1: instant payments
                    var newBalance = account.balance + newCoins
                    changes.balance = newBalance

                    // option 2: payment reservoir where its possible to 'take away' rewards unlike option 1
                    // useful for models where downvotes should punish past upvoters
                    // var newPr = new DecayInt(account.pr, {halflife:1000*60*60*24}).decay(ts)
                    // var newBalance = account.balance + account.pr.v - newPr.v
                    // newPr.v += newCoins
                    // if (newPr.v < 0) newPr.v = 0
                    // changes.balance = newBalance
                    // changes.pr = newPr
                }
                
                cache.updateOne('accounts', {name: name}, {$set: changes}, function(){
                    if (newCoins > 0) {
                        account.balance -= newCoins
                        db.collection('distributed').insertOne({
                            name: name,
                            dist: newCoins,
                            ts: ts
                        }, function(err) {
                            if (err) throw err;
                            transaction.updateGrowInts(account, ts, function(success) {
                                transaction.adjustNodeAppr(account, newCoins, function(success) {
                                    cb(newCoins)
                                })
                            })
                        })
                        
                    } else cb(newCoins)
                })
            })
        })
    }
} 

module.exports = eco