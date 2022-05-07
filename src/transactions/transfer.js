const dao = require('../dao')

module.exports = {
    bsonValidate: true,
    fields: ['receiver', 'amount', 'memo'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.string(tx.data.receiver, config.accountMaxLength, config.accountMinLength, config.allowedUsernameChars, config.allowedUsernameCharsOnlyMiddle)) {
            cb(false, 'invalid tx data.receiver'); return
        }
        if (!validate.integer(tx.data.amount, false, false)) {
            cb(false, 'invalid tx data.amount'); return
        }
        if (!validate.string(tx.data.memo, config.memoMaxLength)) {
            cb(false, 'invalid tx data.memo'); return
        }
        if (tx.data.receiver === tx.sender) {
            cb(false, 'invalid tx cannot send to self'); return
        }

        cache.findOne('accounts', {name: tx.sender}, function(err, account) {
            if (err) throw err
            if (dao.availableBalance(account,ts) < tx.data.amount)
                return cb(false, 'invalid tx not enough balance')

            cache.findOne('accounts', {name: tx.data.receiver}, function(err, account) {
                if (err) throw err
                if (!account) cb(false, 'invalid tx receiver does not exist')
                else cb(true)
            })
        })
    },
    execute: (tx, ts, cb) => {
        // remove funds from sender
        cache.updateOne('accounts', 
            {name: tx.sender},
            {$inc: {balance: -tx.data.amount}},
            function() {
                cache.findOne('accounts', {name: tx.sender}, function(err, accSender) {
                    if (err) throw err
                    // update his bandwidth
                    accSender.balance += tx.data.amount
                    transaction.updateGrowInts(accSender, ts, function() {
                        transaction.adjustNodeAppr(accSender, -tx.data.amount, function() {
                            if (config.burnAccountIsBlackhole && tx.data.receiver === config.burnAccount)
                                return cb(true,0,tx.data.amount)
                            // add funds to receiver
                            cache.updateOne('accounts', 
                                {name: tx.data.receiver},
                                {$inc: {balance: tx.data.amount}},
                                function() {
                                    cache.findOne('accounts', {name: tx.data.receiver}, function(err, accReceiver) {
                                        if (err) throw err
                                        // update his bandwidth
                                        accReceiver.balance -= tx.data.amount
                                        transaction.updateGrowInts(accReceiver, ts, function() {
                                            transaction.adjustNodeAppr(accReceiver, tx.data.amount, function() {
                                                cb(true)
                                            })
                                        })
                                    })
                                })
                        })
                    })
                })
            })
    }
}