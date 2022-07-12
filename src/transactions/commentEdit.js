module.exports = {
    bsonValidate: true,
    fields: ['link', 'json'],
    validate: (tx, ts, legitUser, cb) => {
        // permlink
        if (!validate.string(tx.data.link, config.accountMaxLength, config.accountMinLength))
            return cb(false, 'invalid tx data.link')
        
        // handle arbitrary json input
        if (!validate.json(tx.data.json, config.jsonMaxBytes))
            return cb(false, 'invalid tx data.json')

        // content existence check
        cache.findOne('contents', {_id: tx.sender+'/'+tx.data.link}, function(err, content) {
            if (!content)
                return cb(false, 'cannot edit json of a content that does not exist')
            else
                cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        // bandwidth efficient content json edit without spending vp
        if (process.env.CONTENTS === '1')
            cache.updateOne('contents', {_id: tx.sender+'/'+tx.data.link}, {$set: {json: tx.data.json}}, async () => {
                if (process.env.RANKINGS === '1') {
                    let edited = await cache.findOnePromise('contents',{_id: tx.sender+'/'+tx.data.link})
                    if (!edited.pa && !edited.pp)
                        rankings.new(edited)
                }
                cb(true)
            })
        else
            cb(true)
    }
}