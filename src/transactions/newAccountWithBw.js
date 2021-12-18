const GrowInt = require('growint')

module.exports = {
    fields: ['name', 'pub', 'bw'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.integer(tx.data.bw,false,false))
            return cb(false,'bw must be a valid positive integer')

        require('./newAccount').validate(tx,ts,legitUser,(valid,error) => {
            if (!valid)
                return cb(false,error)
            cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                if (err) throw err
                let bwBefore = new GrowInt(account.bw, {growth:Math.max(account.baseBwGrowth || 0, account.balance)/(config.bwGrowth)}).grow(ts)
                if (bwBefore.v < tx.data.amount)
                    cb(false, 'invalid tx not enough bw')
                else
                    cb(true)
            })
            
        })
    },
    execute: (tx, ts, cb) => {
        // same as NEW_ACCOUNT but with starting tx.data.bw bytes
        // bandwidth debited from account creator in collectGrowInts() method in transaction.js
        let newAccBw = {v:tx.data.bw,t:ts}
        let newAccVt = {v:0,t:0}
        let baseBwGrowth = 0
        if (!config.masterNoPreloadAcc || tx.sender !== config.masterName || config.masterPaysForUsernames) {
            if (config.preloadVt)
                newAccVt = {v:eco.accountPrice(tx.data.name)*config.vtPerBurn*config.preloadVt/100,t:ts}
            if (config.preloadBwGrowth)
                baseBwGrowth = Math.floor(eco.accountPrice(tx.data.name)/config.preloadBwGrowth)
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