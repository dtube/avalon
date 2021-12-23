const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
        /**
         * @api {get} /distribution Wealth Distribution
         * @apiName distribution
         * @apiGroup Economics
         * 
         * @apiSuccess {Array} distribution Tiered wealth distribution of the network, multiplied by 10 for each increment
         */
        app.get('/distribution',(req,res) => {
            let ops = []

            // 0.01 <= $$$ < 1,000,000 DTUBE
            for (let i = 0; i < 8; i++)
                ops.push((cb) => db.collection('accounts').aggregate([
                    {$match: {balance: {$gte: Math.pow(10,i), $lt: Math.pow(10,i+1)}}},
                    {$group: {_id: i, sum: {$sum: '$balance'}, count: {$sum: 1}}}
                ]).toArray((e,r) => cb(e,r[0])))

            // >=1,000,000 DTUBE
            ops.push((cb) => db.collection('accounts').aggregate([
                {$match: {balance: {$gte: Math.pow(10,8)}}},
                {$group: {_id: 8, sum: {$sum: '$balance'}, count: {$sum: 1}}}
            ]).toArray((e,r) => cb(e,r[0])))

            parallel(ops,(errors,results) => {
                if (errors)
                    return res.status(500).send(errors)
                return res.send(results)
            })
        })
    }
}