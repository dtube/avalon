module.exports = {
    fields: ['json'],
    validate: (tx, ts, legitUser, cb) => {
        // handle arbitrary json input
        if (!validate.json(tx.data.json, config.jsonMaxBytes)) {
            cb(false, 'invalid tx data.json'); return
        }
        cb(true)
    },
    execute: (tx, ts, cb) => {

    }
}