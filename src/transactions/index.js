var transactions = [
    require('./newAccount.js'),
    require('./approveNode.js'),
    require('./disaproveNode.js'),
    require('./transfer.js'),
    require('./comment.js'),
    require('./vote.js'),
    require('./userJson.js'),
    require('./follow.js'),
    require('./unfollow.js'),
    null,
    require('./newKey.js'),
    require('./removeKey.js'),
    require('./changePassword.js'),
    require('./promotedComment.js'),
    require('./transferVt.js'),
    require('./transferBw.js')
]

module.exports = {
    Types: {
        NEW_ACCOUNT: 0,
        APPROVE_NODE_OWNER: 1,
        DISAPROVE_NODE_OWNER: 2,
        TRANSFER: 3,
        COMMENT: 4,
        VOTE: 5,
        USER_JSON: 6,
        FOLLOW: 7,
        UNFOLLOW: 8,
        // RESHARE: 9, // not sure
        NEW_KEY: 10,
        REMOVE_KEY: 11,
        CHANGE_PASSWORD: 12,
        PROMOTED_COMMENT: 13,
        TRANSFER_VT: 14,
        TRANSFER_BW: 15
    },
    validate: (tx, ts, legitUser, cb) => {
        if (!transactions[tx.type]) {
            cb(false, 'forbidden transaction type'); return
        }
        transactions[tx.type].validate(tx, ts, legitUser, cb)
    },
    execute: (tx, ts, cb) => {
        if (!transactions[tx.type]) {
            cb(false, 'forbidden transaction type'); return
        }
        transactions[tx.type].execute(tx, ts, cb)
    }
}