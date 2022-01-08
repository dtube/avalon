module.exports = {
    init: (app) => {
        // get blog of user
        app.get('/blog/:username', (req, res) => {
            var username = req.params.username

            db.collection('contents').find({ pa: null, author: username }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                res.send(contents)
            })
        })
        app.get('/blog/:username/:filter', (req, res) => {
            var username = req.params.username
            var filterParam = req.params.filter
            var filter = filterParam.split(':')
            var filterBy = filter[1]
            var filterAttrs = filterBy.split('&')

            var filterMap = {}
            var defaultKeys = ['sortBy']
            var filterKeys = []

            var limit = 50
            for (var k=0; k<filterAttrs.length; k++) {
                var kv = filterAttrs[k].split('=')

                if (kv.length == 2) {
                    var key = kv[0]
                    filterKeys.push(key)
                    var val = kv[1]

                    if (key == 'sortBy') 
                        filterMap['sortBy'] = val
                    else if (key == 'limit') {
                        filterMap['limit'] = parseInt(val)
                        limit = filterMap['limit']
                    }
                }
            }
            var ts = -1
            if (filterMap['sortBy'] == 'desc') 
                ts = -1
            else if (filterMap['sortBy'] == 'asc') 
                ts = 1
            db.collection('contents').find({ pa: null, author: username }, { sort: { ts: ts }, limit: limit }).toArray(function (err, contents) {
                res.send(contents)
            })
        })
        app.get('/blog/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
                $and: [
                    { author: req.params.author },
                    { link: req.params.link }
                ]
            }, function (err, content) {
                if (err || !content) {
                    res.send([])
                    return
                }
                var username = req.params.username
                db.collection('contents').find({
                    $and: [
                        { pa: null },
                        { author: username },
                        { ts: { $lte: content.ts } }
                    ]
                }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                    res.send(contents)
                })
            })
        })
    }
}
