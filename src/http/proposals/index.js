module.exports = {
    init: (app) => {
        // get full list of ranked miners
        app.get('/proposals', (req, res) => {
            db.collection('proposals').find().toArray(function (err, proposals) {
                if (err) throw err
                res.send(proposals)
            })
        })
    }
}
