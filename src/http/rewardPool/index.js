module.exports = {
    init: (app) => {
        // check econ data
        app.get('/rewardPool', (req, res) => {
            if (eco.lastRewardPool)
                res.send(eco.lastRewardPool)
            else res.send({})
        })
    }
}
