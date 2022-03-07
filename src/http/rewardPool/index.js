module.exports = {
    init: (app) => {
        /**
         * @api {get} /rewardPool Reward Pool
         * @apiName rewardPool
         * @apiGroup Economics
         * 
         * @apiSuccess {Double} burn The burned amount in the last reward pool cycle
         * @apiSuccess {Double} dist The distributed amount in the last reward pool cycle
         * @apiSuccess {Double} votes The weighted average VP spent in the last reward pool cycle
         * @apiSuccess {Double} theo The theoretical inflation amount in a single reward pool cycle
         * @apiSuccess {Double} avail The available amount in the current reward pool cycle
         */
        app.get('/rewardPool', (req, res) => {
            if (eco.lastRewardPool)
                res.send(eco.lastRewardPool)
            else res.send({})
        })
    }
}
