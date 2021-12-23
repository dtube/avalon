module.exports = {
    fields: ['target'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.target, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.target'); return
        }

        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
            if (err) throw err
            if (!acc.approves) acc.approves = []
            if (acc.approves.indexOf(tx.data.target) > -1) {
                cb(false, 'invalid tx already voting'); return
            }
            if (acc.approves.length >= config.leaderMaxVotes)
                cb(false, 'invalid tx max votes reached')
            else 
                cache.findOne('accounts', {name: tx.data.target}, function(err, account) {
                    if (!account) 
                        cb(false, 'invalid tx target does not exist')
                    else if (config.disallowVotingInactiveLeader && !account.pub_leader)
                        cb(false, 'target does not have an activated leader signing key')
                    else
                        cb(true)
                    
                })
            
        })
    },
    execute: (tx, ts, cb) => {
        cache.updateOne('accounts', 
            {name: tx.sender},
            {$push: {approves: tx.data.target}},
            function() {
                cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                    if (err) throw err
                    if (!acc.approves) acc.approves = []
                    let node_appr = Math.floor(acc.balance/acc.approves.length)
                    let node_appr_before = (acc.approves.length === 1 ? 0 : Math.floor(acc.balance/(acc.approves.length-1)))
                    let node_owners = []
                    for (let i = 0; i < acc.approves.length; i++)
                        if (acc.approves[i] !== tx.data.target)
                            node_owners.push(acc.approves[i])

                    cache.updateMany('accounts', 
                        {name: {$in: node_owners}},
                        {$inc: {node_appr: node_appr-node_appr_before}}, function() {
                            cache.updateOne('accounts', 
                                {name: tx.data.target},
                                {$inc: {node_appr: node_appr}}, function() {
                                    cb(true)
                                }
                            )
                        })
                })
            })
    }
}