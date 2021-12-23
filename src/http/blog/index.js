module.exports = {
    init: (app) => {
        /**
         * @api {get} /blog/:username User Blog
         * @apiName blog
         * @apiGroup Contents
         * 
         * @apiParam {String} username Username to retrieve blog of
         * 
         * @apiSuccess {Array} contents List of root contents authored by username
         */
        app.get('/blog/:username', (req, res) => {
            let username = req.params.username

            db.collection('contents').find({ pa: null, author: username }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                res.send(contents)
            })
        })

        /**
         * @api {get} /blog/:username/:filter User Blog with Filter
         * @apiName blogWithFilter
         * @apiGroup Contents
         * 
         * @apiParam {String} username Username to retrieve blog of
         * @apiParam {String} filter Filter parameters
         * 
         * @apiSuccess {Array} posts Filtered list of root posts authored by username
         */
        app.get('/blog/:username/:filter', (req, res) => {
            let username = req.params.username
            let filterParam = req.params.filter
            let filter = filterParam.split(':')
            let filterBy = filter[1]
            let filterAttrs = filterBy.split('&')

            let filterMap = {}
            let filterKeys = []

            let limit = 50
            for (let k=0; k<filterAttrs.length; k++) {
                let kv = filterAttrs[k].split('=')

                if (kv.length === 2) {
                    let key = kv[0]
                    filterKeys.push(key)
                    let val = kv[1]

                    if (key === 'sortBy') 
                        filterMap['sortBy'] = val
                    else if (key === 'limit') {
                        filterMap['limit'] = parseInt(val)
                        limit = filterMap['limit']
                    }
                }
            }
            let ts = -1
            if (filterMap['sortBy'] === 'desc') 
                ts = -1
            else if (filterMap['sortBy'] === 'asc') 
                ts = 1
            db.collection('contents').find({ pa: null, author: username }, { sort: { ts: ts }, limit: limit }).toArray(function (err, contents) {
                res.send(contents)
            })
        })

        /**
         * @api {get} /blog/:username/:link User Blog (Continued)
         * @apiName blogContinued
         * @apiGroup Contents
         * 
         * @apiParam {String} username Username to retrieve blog of
         * @apiParam {String} author Author of post to continue from
         * @apiParam {String} link Permlink of post to continue from
         * 
         * @apiSuccess {Array} posts List of root posts authored by username continued
         */
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
                let username = req.params.username
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
