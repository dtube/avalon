const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
        /**
         * @api {get} /accountByKey/:pub Accounts by Public Key
         * @apiName accountByKey
         * @apiGroup Accounts
         * 
         * @apiParam {String} pub Public key to query
         * 
         * @apiSuccess {Array} accounts Account list. First element lists accounts with `pub` as master key, second element lists accounts with `pub` as custom key.
         */
        app.get('/accountByKey/:pub', (req,res) => {
            let ops = [
                (cb) => db.collection('accounts').find({pub: req.params.pub}).toArray(cb),
                (cb) => db.collection('accounts').find({'keys.pub': req.params.pub}).toArray(cb)
            ]
            parallel(ops,(errors,results) => {
                if (errors)
                    return res.status(500).send(errors)
                return res.send(results)
            })
        })
    }
}