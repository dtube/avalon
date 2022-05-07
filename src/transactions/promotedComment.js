const dao = require('../dao')

module.exports = {
    bsonValidate: true,
    fields: ['link', 'pa', 'pp', 'json', 'vt', 'tag', 'burn'],
    validate: (tx, ts, legitUser, cb) => {
        // first verify that the user isn't editing an existing content
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength)) {
            cb(false, 'invalid tx data.link'); return
        }
        cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
            if (err) throw err
            if (content) {
                cb(false, 'cannot edit and promote'); return
            }
            // then verify that the same comment without promotion would be ok
            let comment = {
                type: 4,
                data: Object.assign({}, tx.data)
            }
            delete comment.data.burn
            transaction.isValidTxData(comment, ts, legitUser, function(isValid, error) {
                if (isValid) {
                    // and checking if user has enough coins to burn
                    if (!tx.data.burn || typeof tx.data.burn !== 'number' || tx.data.burn < 1 || tx.data.burn > Number.MAX_SAFE_INTEGER) {
                        cb(false, 'invalid tx data.burn'); return
                    }
                    cache.findOne('accounts', {name: tx.sender}, function(err, account) {
                        if (err) throw err
                        if (dao.availableBalance(account,ts) < tx.data.burn)
                            return cb(false, 'invalid tx not enough balance to burn')
                        cb(true)
                    })
                } else
                    cb(isValid, error)
            })
        })
    },
    execute: (tx, ts, cb) => {
        // almost same logic as comment
        // except we are sure its a new content
        let superVote = {
            u: tx.sender,
            ts: ts,
            vt: tx.data.vt+(tx.data.burn * config.vtPerBurn), // we just add some extra VTs
            burn: tx.data.burn // add burn data for later
        }
        let newContent = {
            _id: tx.sender+'/'+tx.data.link,
            author: tx.sender,
            link: tx.data.link,
            pa: tx.data.pa,
            pp: tx.data.pp,
            json: process.env.CONTENTS === '1' ? tx.data.json : {},
            child: [],
            votes: [superVote],
            ts: ts
        }
        if (tx.data.tag && process.env.CONTENTS === '1')  {
            superVote.tag = tx.data.tag
            newContent.tags = {}
            newContent.tags[tx.data.tag] = Math.abs(superVote.vt)
        }
        // and burn some coins, update bw/vt and leader vote scores as usual
        cache.updateOne('accounts', {name: tx.sender}, {$inc: {balance: -tx.data.burn}}, function() {
            cache.findOne('accounts', {name: tx.sender}, function(err, sender) {
                sender.balance += tx.data.burn
                transaction.updateGrowInts(sender, ts, function() {
                    transaction.adjustNodeAppr(sender, -tx.data.burn, function() {
                        // insert content+vote into db
                        cache.insertOne('contents', newContent, function(){
                            eco.curation(tx.sender, tx.data.link, function(distCurators, distMaster) {
                                if (tx.data.pa && tx.data.pp && process.env.CONTENTS === '1')
                                    cache.updateOne('contents', {_id: tx.data.pa+'/'+tx.data.pp}, { $push: {
                                        child: [tx.sender, tx.data.link]
                                    }}, function() {
                                        cb(true, distCurators+distMaster, tx.data.burn)
                                    })
                                else {
                                    // and report how much was burnt
                                    cb(true, distCurators+distMaster, tx.data.burn)
                                    if (!tx.data.pa || !tx.data.pp) rankings.new(newContent)
                                }
                            }) 
                            
                        })
                    })
                })
            })
            
        })
    }
}