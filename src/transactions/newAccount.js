const dao = require('../dao')

module.exports = {
    fields: ['name', 'pub'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.name, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.name'); return
        }
        if (!validate.publicKey(tx.data.pub, config.accountMaxLength)) {
            cb(false, 'invalid tx data.pub'); return
        }

        let lowerUser = tx.data.name.toLowerCase()

        for (let i = 0; i < lowerUser.length; i++) {
            const c = lowerUser[i]
            // allowed username chars
            if (config.allowedUsernameChars.indexOf(c) === -1) 
                if (config.allowedUsernameCharsOnlyMiddle.indexOf(c) === -1) {
                    cb(false, 'invalid tx data.name char '+c); return
                } else if (i === 0 || i === lowerUser.length-1) {
                    cb(false, 'invalid tx data.name char '+c+' can only be in the middle'); return
                }
            
        }

        cache.findOne('accounts', {name: lowerUser}, function(err, account) {
            if (err) throw err
            if (account)
                cb(false, 'invalid tx data.name already exists')
            else
                cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                    if (err) throw err
                    if (dao.availableBalance(account,ts) < eco.accountPrice(lowerUser))
                        cb(false, 'invalid tx not enough balance')
                    else
                        cb(true)
                })
        })
    },
    execute: (tx, ts, cb) => {
        let newAccBw = {v:0,t:0}
        let newAccVt = {v:0,t:0}
        let baseBwGrowth = 0
        if (!config.masterNoPreloadAcc || tx.sender !== config.masterName || config.masterPaysForUsernames) {
            if (config.preloadVt)
                newAccVt = {v:Math.floor(eco.accountPrice(tx.data.name)*config.vtPerBurn*config.preloadVt/100),t:ts}
            if (config.preloadBwGrowth) {
                newAccBw = {v:0,t:ts}
                baseBwGrowth = Math.floor(eco.accountPrice(tx.data.name)/config.preloadBwGrowth)
            }
        }
        cache.insertOne('accounts', {
            name: tx.data.name.toLowerCase(),
            pub: tx.data.pub,
            balance: 0,
            bw: newAccBw,
            vt: newAccVt,
            baseBwGrowth: baseBwGrowth,
            follows: [],
            followers: [],
            keys: [],
            created: {
                by: tx.sender,
                ts: ts
            }
        }, function(){
            if (tx.sender !== config.masterName || config.masterPaysForUsernames)
                cache.updateOne('accounts', 
                    {name: tx.sender},
                    {$inc: {balance: -eco.accountPrice(tx.data.name)}}, function() {
                        cache.findOne('accounts', {name: tx.sender}, function(err, acc) {
                            if (err) throw err
                            // update his bandwidth
                            acc.balance += eco.accountPrice(tx.data.name)
                            transaction.updateGrowInts(acc, ts, function() {
                                transaction.adjustNodeAppr(acc, -eco.accountPrice(tx.data.name), function() {
                                    cb(true, null, eco.accountPrice(tx.data.name))
                                })
                            })
                        })
                    })
            else cb(true)
        })
    }
}