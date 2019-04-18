module.exports = {
    fields: ['pub'],
    validate: (tx, ts, legitUser, cb) => {
        if (!validate.publicKey(tx.data.pub, config.accountMaxLength)) {
            cb(false, 'invalid tx data.pub'); return
        }
        cb(true)
    },
    execute: (tx, ts, cb) => {

    }
}