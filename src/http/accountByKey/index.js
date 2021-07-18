const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
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