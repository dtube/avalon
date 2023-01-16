const TransactionType = require('./transactions').Types

// List of potential community-breaking abuses:
// 1- Multi accounts voting (cartoons)
// 2- Bid-bots (selling votes)
// 3- Self-voting whales (haejin)
// 4- Curation trails (bots auto-voting tags or authors)

// What we decided:
// 1- Flat curation
// 2- Money goes into content, claim button stops curation rewards
// 3- People can claim curation rewards after X days. Time lock to allow downvotes to take away rewards
// 4- Rentability curve: based on time since the vote was cast. Starts at X%, goes up to 100% at optimal voting time, then goes down to Y% at the payout time and after.
// 5- Downvotes print the same DTC amount as an upvote would. But they also reduce upvote rewards by X% of that amount
// 6- Use weighted averages for rewardPool data to smooth it out

let eco = {
    startRewardPool: null,
    lastRewardPool: null,
    currentBlock: {
        dist: 0,
        burn: 0,
        votes: 0
    },
    history: [],
    nextBlock: () => {
        eco.currentBlock.dist = 0
        eco.currentBlock.burn = 0
        eco.currentBlock.votes = 0
        if (eco.startRewardPool)
            eco.lastRewardPool = eco.startRewardPool
        eco.startRewardPool = null
    },
    loadHistory: () => {
        eco.history = []
        let lastCBurn = 0
        let lastCDist = 0
        let firstBlockIndex = chain.recentBlocks.length - config.ecoBlocks
        if (firstBlockIndex < 0) firstBlockIndex = 0
        for (let i = firstBlockIndex; i < chain.recentBlocks.length; i++) {
            const block = chain.recentBlocks[i]
            if (block.burn)
                lastCBurn += block.burn
            if (block.dist)
                lastCDist += block.dist

            eco.history.push({_id: block._id, votes: eco.tallyVotes(block.txs)})
        }

        eco.history[eco.history.length-1].cDist = eco.round(lastCDist)
        eco.history[eco.history.length-1].cBurn = eco.round(lastCBurn)
    },
    appendHistory: (nextBlock) => {
        // nextBlock should yet to be added to recentBlocks
        let lastIdx = chain.recentBlocks.length-config.ecoBlocks
        let oldDist = lastIdx >= 0 ? chain.recentBlocks[lastIdx].dist || 0 : 0
        let oldBurn = lastIdx >= 0 ? chain.recentBlocks[lastIdx].burn || 0 : 0
        eco.history.push({
            _id: nextBlock._id,
            votes: eco.tallyVotes(nextBlock.txs),
            cDist: eco.round(eco.history[eco.history.length-1].cDist - oldDist + (nextBlock.dist || 0)),
            cBurn: eco.round(eco.history[eco.history.length-1].cBurn - oldBurn + (nextBlock.burn || 0))
        })
    },
    cleanHistory: () => {
        if (config.ecoBlocksIncreasesSoon) return
        let extraBlocks = eco.history.length - config.ecoBlocks
        while (extraBlocks > 0) {
            eco.history.shift()
            extraBlocks--
        }
    },
    tallyVotes: (txs = []) => {
        let votes = 0
        for (let y = 0; y < txs.length; y++)
            if (txs[y].type === TransactionType.VOTE
                || txs[y].type === TransactionType.COMMENT
                || txs[y].type === TransactionType.PROMOTED_COMMENT
                || (txs[y].type === TransactionType.TIPPED_VOTE && config.hotfix1))
                votes += Math.abs(txs[y].data.vt)
        return votes
    },
    rewardPool: () => {
        let theoricalPool = config.rewardPoolAmount
        let burned = 0
        let distributed = 0
        let votes = 0
        if (!eco.startRewardPool) {
            distributed = eco.history[eco.history.length-1].cDist
            burned = eco.history[eco.history.length-1].cBurn
            let firstBlockIndex = eco.history.length - config.ecoBlocks
            if (firstBlockIndex < 0) firstBlockIndex = 0
            let weight = 1
            for (let i = firstBlockIndex; i < eco.history.length; i++) {
                votes += eco.history[i].votes*weight
                weight++
            }

            // weighted average for votes
            votes /= (weight+1)/2

            eco.startRewardPool = {
                burn: burned,
                dist: distributed,
                votes: votes,
                theo: theoricalPool,
                avail: theoricalPool - distributed
            }
        } else {
            burned = eco.startRewardPool.burn
            distributed = eco.startRewardPool.dist
            votes = eco.startRewardPool.votes
        }
        

        let avail = theoricalPool - distributed - eco.currentBlock.dist
        if (avail < 0) avail = 0
        burned += eco.currentBlock.burn
        distributed += eco.currentBlock.dist
        votes += eco.currentBlock.votes

        avail = eco.round(avail)
        burned = eco.round(burned)
        distributed = eco.round(distributed)
        votes = eco.round(votes)
        return {
            theo: theoricalPool,
            burn: burned,
            dist: distributed,
            votes: votes,
            avail: avail
        }
    },
    accountPrice: (username) => {
        let price = config.accountPriceMin
        let extra = config.accountPriceBase - config.accountPriceMin
        let mult = Math.pow(config.accountPriceChars / username.length, config.accountPriceCharMult)
        price += Math.round(extra*mult)
        return price
    },
    curation: (author, link, cb) => {
        cache.findOne('contents', {_id: author+'/'+link}, function(err, content) {
            let currentVote = content.votes[content.votes.length-1]

            // first loop to calculate the VP of active votes
            let sumVtWinners = 0
            for (let i = 0; i < content.votes.length; i++)
                if (!content.votes[i].claimed)
                    if (currentVote.vt*content.votes[i].vt > 0)
                        sumVtWinners += content.votes[i].vt

            // second loop to calculate each active votes shares
            let winners = []
            for (let i = 0; i < content.votes.length; i++)
                if (!content.votes[i].claimed)
                    if (currentVote.vt*content.votes[i].vt > 0) {
                        // same vote direction => winner
                        let winner = content.votes[i]
                        winner.share = winner.vt / sumVtWinners
                        winners.push(winner)
                    }

            let thNewCoins = eco.print(currentVote.vt)
            // share the new coins between winners
            let newCoins = 0
            for (let i = 0; i < winners.length; i++) {
                if (!winners[i].gross)
                    winners[i].gross = 0
                
                let won = thNewCoins * winners[i].share
                let rentabilityWinner = eco.rentability(winners[i].ts, currentVote.ts, currentVote.vt < 0)
                won *= rentabilityWinner
                won = eco.floor(won)
                winners[i].gross += won
                newCoins += won
                delete winners[i].share

                // logr.econ(winners[i].u+' wins '+won+' coins with rentability '+rentabilityWinner)
            }
            newCoins = eco.round(newCoins)

            // reconstruct the votes array
            let newVotes = []
            for (let i = 0; i < content.votes.length; i++)
                if (!content.votes[i].claimed && currentVote.vt*content.votes[i].vt > 0) {
                    for (let y = 0; y < winners.length; y++)
                        if (winners[y].u === content.votes[i].u)
                            newVotes.push(winners[y])
                } else newVotes.push(content.votes[i])

            // if there are opposite votes
            // burn 50% of the printed DTC in anti-chronological order
            let newBurn = 0
            let takeAwayAmount = thNewCoins*config.ecoPunishPercent
            let i = content.votes.length - 1
            while (takeAwayAmount !== 0 && i>=0) {
                if (i === 0 && !config.ecoPunishAuthor)
                    break
                if (!content.votes[i].claimed && content.votes[i].vt*currentVote.vt < 0)
                    if (content.votes[i].gross >= takeAwayAmount) {
                        content.votes[i].gross -= takeAwayAmount
                        newBurn += takeAwayAmount
                        takeAwayAmount = 0
                    } else {
                        takeAwayAmount -= content.votes[i].gross
                        newBurn += content.votes[i].gross
                        content.votes[i].gross = 0
                    }
                i--
            }
            newBurn = eco.round(newBurn)
            
            logr.econ(newCoins + ' dist from the vote')
            logr.econ(newBurn + ' burn from the vote')

            // compute final claimable amount after author tip
            let authorVote = -1
            let authorVoteClaimed = false
            let totalAuthorTip = 0
            let precisionMulti = Math.pow(10,config.ecoClaimPrecision+config.tippedVotePrecision)
            // determine existence and position of author vote
            for (let v = 0; v < newVotes.length; v++)
                if (newVotes[v].u === content.author) {
                    authorVote = v
                    if (newVotes[v].claimed) authorVoteClaimed = true
                    if (!config.allowRevotes) break
                }
            // tally up tip amount
            for (let v = 0; v < newVotes.length; v++) {
                if (authorVote >= 0 && newVotes[v].u !== content.author && newVotes[v].tip)
                    if (!authorVoteClaimed) {
                        let tipAmt = (newVotes[v].gross * Math.pow(10,config.ecoClaimPrecision)) * (newVotes[v].tip * Math.pow(10,config.tippedVotePrecision))
                        totalAuthorTip += tipAmt
                        newVotes[v].totalTip = tipAmt / precisionMulti
                        newVotes[v].claimable = ((newVotes[v].gross * precisionMulti) - tipAmt) / precisionMulti
                    } else
                        newVotes[v].claimable = ((newVotes[v].gross * precisionMulti) - (newVotes[v].totalTip * precisionMulti)) / precisionMulti
                else if (newVotes[v].u !== content.author)
                    newVotes[v].claimable = newVotes[v].gross
                // failsafe to ensure claimable cannot be negative
                if (newVotes[v].claimable < 0)
                    newVotes[v].claimable = 0
            }
            // apply all tips to author vote
            if (authorVote >= 0 && !authorVoteClaimed)
                newVotes[authorVote].claimable = ((newVotes[authorVote].gross * precisionMulti) + totalAuthorTip) / precisionMulti

            // add dist/burn/votes to currentBlock eco stats
            eco.currentBlock.dist += newCoins
            eco.currentBlock.dist = eco.round(eco.currentBlock.dist)
            eco.currentBlock.burn += newBurn
            eco.currentBlock.burn = eco.round(eco.currentBlock.burn)
            eco.currentBlock.votes += currentVote.vt

            // updating the content
            // increase the dist amount for display
            // and update the votes array
            cache.updateOne('contents', {_id: author+'/'+link}, {
                $inc: {distGross: newCoins, burn: newBurn},
                $set: {votes: newVotes, dist: eco.round((content.dist || 0)+newCoins-newBurn)}
            }, function() {
                if (config.masterFee > 0 && newCoins > 0) {
                    // apply the master fee
                    let distBefore = content.distGross
                    if (!distBefore) distBefore = 0
                    let distAfter = distBefore + newCoins
                    let benefReward = Math.floor(distAfter/config.masterFee) - Math.floor(distBefore/config.masterFee)
                    if (benefReward > 0) 
                        cache.updateOne('accounts', {name: config.masterName}, {$inc: {balance: benefReward}}, function() {
                            cache.insertOne('distributed', {
                                name: config.masterName,
                                dist: benefReward,
                                ts: currentVote.ts,
                                _id: content.author+'/'+content.link+'/'+currentVote.u+'/'+config.masterName
                            }, function() {
                                cache.findOne('accounts', {name: config.masterName}, function(err, masterAccount) {
                                    masterAccount.balance -= benefReward
                                    transaction.updateGrowInts(masterAccount, currentVote.ts, function() {
                                        transaction.adjustNodeAppr(masterAccount, benefReward, function() {
                                            cb(newCoins, benefReward, newBurn)
                                        })
                                    })
                                })
                            })
                        })
                    else cb(newCoins, 0)
                } else cb(newCoins, 0)
            })
        })
    },
    print: (vt) => {
        // loads current reward pool data
        // and converts VP to DTC based on reward pool stats
        let stats = eco.rewardPool()
        // if reward pool is empty, print nothing
        // (can only happen if witnesses freeze distribution in settings)
        if (stats.avail === 0)
            return 0

        let thNewCoins = 0

        // if theres no vote in reward pool stats, we print 1 coin (minimum)
        if (stats.votes === 0)
            thNewCoins = 1
        // otherwise we proportionally reduce based on recent votes weight
        // and how much is available for printing
        else
            thNewCoins = stats.avail * Math.abs((vt) / stats.votes)

        // rounding down
        thNewCoins = eco.floor(thNewCoins)
        
        // and making sure one person cant empty the whole pool when network has been inactive
        // e.g. when stats.votes close to 0
        // then vote value will be capped to rewardPoolMaxShare %
        if (thNewCoins > Math.floor(stats.avail*config.rewardPoolMaxShare))
            thNewCoins = Math.floor(stats.avail*config.rewardPoolMaxShare)

        logr.econ('PRINT:'+vt+' VT => '+thNewCoins+' dist', stats.avail)
        return thNewCoins
    },
    rentability: (ts1, ts2, isDv) => {
        let ts = ts2 - ts1
        if (ts < 0) throw 'Invalid timestamp in rentability calculation'

        // https://imgur.com/a/GTLvs37
        let directionRent = isDv ? config.ecoDvRentFactor : 1
        let startRentability = config.ecoStartRent
        let baseRentability = config.ecoBaseRent
        let rentabilityStartTime = config.ecoRentStartTime
        let rentabilityEndTime = config.ecoRentEndTime
        let claimRewardTime = config.ecoClaimTime

        // requires that :
        // rentabilityStartTime < rentabilityEndTime < claimRewardTime

        // between rentStart and rentEnd => 100% max rentability
        let rentability = 1

        if (ts === 0)
            rentability = startRentability
        
        else if (ts < rentabilityStartTime)
            // less than one day, rentability grows from 50% to 100%
            rentability = startRentability + (1-startRentability) * ts / rentabilityStartTime

        else if (ts >= claimRewardTime)
            // past 7 days, 50% base rentability
            rentability = baseRentability

        else if (ts > rentabilityEndTime)
            // more than 3.5 days but less than 7 days
            // decays from 100% to 50%
            rentability = baseRentability + (1-baseRentability) * (claimRewardTime-ts) / (claimRewardTime-rentabilityEndTime)


        rentability = Math.floor(directionRent*rentability*Math.pow(10, config.ecoRentPrecision))/Math.pow(10, config.ecoRentPrecision)
        return rentability
    },
    round: (val = 0) => Math.round(val*Math.pow(10,config.ecoClaimPrecision))/Math.pow(10,config.ecoClaimPrecision),
    floor: (val = 0) => Math.floor(val*Math.pow(10,config.ecoClaimPrecision))/Math.pow(10,config.ecoClaimPrecision)
} 

module.exports = eco