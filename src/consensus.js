const consensus_need = 2
const consensus_total = 3
const consensus_threshold = consensus_need/consensus_total

// all p2p.sockets referenced here are verified nodes with a node_status

var consensus = {
    validating: [],
    finalizing: false,
    possBlocks: [],
    buffer: [],
    onlineLeaders: () => {
        // list top leaders
        var leaders = []
        for (let y = 0; y < chain.schedule.shuffle.length; y++)
            if (leaders.indexOf(chain.schedule.shuffle[y].name) === -1)
                leaders.push(chain.schedule.shuffle[y].name)
        
        // count ourselves as active connected leader
        var onlineLeaders = [process.env.NODE_OWNER]

        // and see which we're connected with
        // and on the same chain and close (same block or previous one)
        // should be 100%, except in node startup / replay phase
        // but should always be 100% after a minute or so
        for (let i = 0; i < p2p.sockets.length; i++) {
            if (!p2p.sockets[i].node_status) continue
            for (let y = 0; y < leaders.length; y++)
                if (onlineLeaders.indexOf(leaders[y]) === -1
                && p2p.sockets[i].node_status.owner === leaders[y]
                && (p2p.sockets[i].node_status.head_block_hash === chain.getLatestBlock().hash
                    || p2p.sockets[i].node_status.previous_block_hash === chain.getLatestBlock().hash
                    || p2p.sockets[i].node_status.head_block_hash === chain.getLatestBlock().phash)
                )
                    onlineLeaders.push(leaders[y])
        }

        return onlineLeaders
    },
    tryNextStep: () => {
        var onlineLeaders = consensus.onlineLeaders()
        var threshold = onlineLeaders.length * consensus_threshold

        for (let i = 0; i < consensus.possBlocks.length; i++) {
            const possBlock = consensus.possBlocks[i]
            //logr.debug('CON/'+onlineLeaders.length, possBlock[0].length, possBlock[1].length)
            // if 2/3+ of the final round and not already finalizing another block
            if (possBlock[config.consensusRounds-1].length > threshold 
            && !consensus.finalizing 
            && possBlock.block._id === chain.getLatestBlock()._id+1
            && possBlock[0] && possBlock[0].indexOf(process.env.NODE_OWNER) !== -1) {
                // block becomes valid, we can move forward !
                consensus.finalizing = true
                logr.trace('CON block '+possBlock.block._id+'#'+possBlock.block.hash.substr(0,4)+' got finalized')
                chain.validateAndAddBlock(possBlock.block, false, function(err) {
                    if (err) throw err

                    // clean up old possible blocks
                    var newPossBlocks = []
                    for (let y = 0; y < consensus.possBlocks.length; y++) 
                        if (possBlock.block._id < consensus.possBlocks[y].block._id)
                            newPossBlocks.push(consensus.possBlocks[y])
                    
                    consensus.possBlocks = newPossBlocks
                    consensus.finalizing = false
                })
            }
            // if 2/3+ of any previous round, we try to commit it again
            else for (let y = 0; y < config.consensusRounds-1; y++)
                if (possBlock[y].length > threshold)
                    consensus.round(y+1, possBlock.block) 
        }
    },
    round: (round, block) => {
        // ignore for different block height
        if (block._id !== chain.getLatestBlock()._id+1)
            return

        //logr.debug('ROUND:'+round+' '+block._id+'#'+block.hash.substr(0,4))

        if (round === 0) {
            // precommit stage

            // skip whatever we already validated
            for (let i = 0; i < consensus.possBlocks.length; i++)
                if (consensus.possBlocks[i].block.hash === block.hash)
                    return

            // or are currently validating
            if (consensus.validating.indexOf(block.hash) > -1)
                return
            consensus.validating.push(block.hash)

            // its valid, set up the empty possible block
            var possBlock = {
                block:block
            }
            for (let r = 0; r < config.consensusRounds; r++)
                possBlock[r] = []

            // consider the miner who signed the block to have passed all consensus stages
            for (let r = 0; r < config.consensusRounds; r++)
                possBlock[r].push(block.miner)
    
            // and saving into consensus data
            consensus.possBlocks.push(possBlock)

            // now we verify the block is valid
            logr.trace('CON/ New poss block '+block._id+'#'+block.hash.substr(0,4))
            chain.isValidNewBlock(block, true, true, function(isValid) {
                consensus.validating.splice(consensus.validating.indexOf(possBlock.block.hash), 1)                
                if (!isValid) {
                    // todo add punishment (close socket?)
                    logr.error('Received invalid new block', block.hash)

                } else {
                    logr.trace('CON/ Precommitting block '+block._id+'#'+block.hash.substr(0,4))

                    // precommitting ourselves
                    for (let i = 0; i < consensus.possBlocks.length; i++) 
                        if (block.hash === consensus.possBlocks[i].block.hash
                        && block.miner !== process.env.NODE_OWNER
                        && consensus.possBlocks[i][0].indexOf(process.env.NODE_OWNER) === -1)
                            possBlock[0].push(process.env.NODE_OWNER)

                    // and broadcasting the precommit to our peers
                    consensus.endRound(round, block)
                }
            })
        } else
            // commit stage
            for (let b = 0; b < consensus.possBlocks.length; b++) 
                if (consensus.possBlocks[b].block.hash === block.hash
                && consensus.possBlocks[b][round].indexOf(process.env.NODE_OWNER) === -1) {
                    consensus.possBlocks[b][round].push(process.env.NODE_OWNER)
                    consensus.endRound(round, block)
                }
    },
    endRound: (round, block) => {
        // broadcast to our peers
        p2p.broadcast({t:6, d:{r:round, b: block}})
        // try to move to next consensus step
        consensus.tryNextStep()
    },
    messenger: (socket, round, block) => {
        for (let i = 0; i < consensus.possBlocks.length; i++) 
            if (block.hash === consensus.possBlocks[i].block.hash
            && consensus.possBlocks[i][round].indexOf(socket.node_status.owner) === -1) {
                // add the leader to the ones who passed precommit
                consensus.possBlocks[i][round].push(socket.node_status.owner)
                consensus.tryNextStep()
            }
    }
}

module.exports = consensus