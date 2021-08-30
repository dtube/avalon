module.exports = {
    init: (app) => {
        // get feed contents
        app.get('/feed/:username', (req, res) => {
            db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                if (!account || !account.follows)
                    res.send([])
                else
                    db.collection('contents').find({
                        $and: [
                            { author: { $in: account.follows } },
                            { pa: null }
                        ]
                    }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                        res.send(contents)
                    })

            })
        })
        app.get('/feed/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
                $and: [
                    { author: req.params.author },
                    { link: req.params.link }
                ]
            }, function (err, content) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account || !account.follows)
                        res.send([])
                    else
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { pa: null },
                                { ts: { $lte: content.ts } }
                            ]
                        }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                            res.send(contents)
                        })

                })
            })
        })
    }
}
