module.exports = {
    init: (app) => {
        // get distributions for a user
        app.get('/distributed/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('distributed').find({ name: req.params.name }, { sort: { ts: -1 }, limit: 200 }).toArray(function (err, distributions) {
                if (!distributions) res.sendStatus(404)
                else res.send(distributions)
            })
        })
    }
}
