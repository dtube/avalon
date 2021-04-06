module.exports = {
    init: (app) => {
        // get full list of ranked miners
        app.get('/allminers', (req, res) => {
            db.collection('accounts').find({ node_appr: { $gt: 0 } }, {
                sort: { node_appr: -1 }
            }).toArray(function (err, accounts) {
                if (err) throw err
                res.send(accounts)
            })
        })
    }
}
