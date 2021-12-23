module.exports = {
    init: (app) => {
        /**
         * @api {get} /blog/:username User Feed
         * @apiName feed
         * @apiGroup Contents
         * 
         * @apiParam {String} username Username to retrieve feed of
         * 
         * @apiSuccess {Array} contents List of root contents authored followed accounts
         */
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

        /**
         * @api {get} /blog/:username User Feed (Continued)
         * @apiName feedContinued
         * @apiGroup Contents
         * 
         * @apiParam {String} username Username to retrieve feed of
         * @apiParam {String} author Author of post to continue from
         * @apiParam {String} permlink Permlink of post to continue from
         * 
         * @apiSuccess {Array} posts List of root posts authored by followed accounts continued
         */
        app.get('/feed/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
                $and: [
                    { author: req.params.author },
                    { link: req.params.link }
                ]
            }, function (err, content) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
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

        // get feed by tag with limit by certain author
        // filter = author,tag,limit,ts(from, to)
        // $API_URL/filter?author=author1,author2,...,authorN&tag=tag1,tag2,...,tagN&limit=x&ts=tsfrom-tsto
        /**
         * @api {get} /blog/:username/:filter User Feed with Filter
         * @apiName feedWithFilter
         * @apiGroup Contents
         * 
         * @apiParam {String} username Username to retrieve feed of
         * @apiParam {String} filter Filter parameters
         * 
         * @apiSuccess {Array} posts Filtered list of root posts authored by followed accounts
         */
        app.get('/feed/:username/:filter', (req, res) => {
            let filterParam = req.params.filter
            let filter = filterParam.split(':')
            let filterBy = filter[1]
            let filterAttrs = filterBy.split('&')

            let filterMap = {}
            let defaultKeys = ['authors', 'tags', 'limit', 'tsrange']
            let filterKeys = []

            for (let k=0; k<filterAttrs.length; k++) {
                let kv = filterAttrs[k].split('=')

                if (kv.length === 2) {
                    let key = kv[0]
                    filterKeys.push(key)
                    let val = kv[1]

                    if (key === 'authors') 
                        filterMap['authors'] = val.split(',')
                    else if (key === 'tags') 
                        filterMap['tags'] = val.split(',')
                    else if (key === 'limit') 
                        filterMap['limit'] = parseInt(val)
                    else if (key === 'tsrange') 
                        filterMap['tsrange'] = val.split(',')
                }
            }

            for (let k=0; k<defaultKeys.length; k++) {
                let key = defaultKeys[k]

                if (!filterKeys.includes(key)) 
                    if (key === 'authors') {
                        filterMap['authors'] = []
                        filterMap['authors'].push('all')
                    } else if (key === 'tags') {
                        filterMap['tags'] = []
                        filterMap['tags'].push('all')
                    } else if (key === 'limit') 
                        filterMap['limit'] = 50
                    else if (key === 'tsrange') {
                        filterMap['tsrange'] = []
                        filterMap['tsrange'].push(0)
                        filterMap['tsrange'].push(Number.MAX_SAFE_INTEGER)
                    }
            }

            let authors = filterMap['authors']

            let authors_in = []
            let authors_ex = []
            for(let i=0; i<authors.length; i++) 
                if(authors[i].includes('^'))
                    authors_ex.push(authors[i].substring(1, authors[i].length))
                else 
                    authors_in.push(authors[i])
            let tags = filterMap['tags']

            let tags_in = []
            let tags_ex = []
            for(let i=0; i<tags.length; i++) 
                if(tags[i].includes('^'))
                    tags_ex.push(tags[i].substring(1, tags[i].length))
                else 
                    tags_in.push(tags[i])
            let limit = filterMap['limit']

            if(limit === -1 || isNaN(limit)) 
                limit = Number.MAX_SAFE_INTEGER

            let tsrange = filterMap['tsrange']
            let tsfrom, tsto
            if (tsrange.length === 2) {
                tsfrom = parseInt(tsrange[0]) * 1000
                tsto = parseInt(tsrange[1]) * 1000
            } else 
                return

            if (authors.includes('all') && !tags.includes('all')) 
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else 
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                {
                                    $or: [
                                        {
                                            $and: [
                                                { 'json.tag': { $in: tags_in } },
                                                { 'json.tag': { $nin: tags_ex } },
                                            ],
                                        },
                                        {
                                            $and: [
                                                { votes: { $elemMatch: { tag: { $in: tags_in } } } },
                                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } }
                                            ]
                                        }
                                    ]
                                },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit}).toArray(function (err, contents) {
                            res.send(contents)
                        })
                    
                })
            else if (!authors.includes('all') && !tags.includes('all')) 
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else 
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { author: { $in : authors_in } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                {
                                    $or: [
                                        {
                                            $and: [
                                                { 'json.tag': { $in: tags_in } },
                                                { 'json.tag': { $nin: tags_ex } },
                                            ],
                                        },
                                        {
                                            $and: [
                                                { votes: { $elemMatch: { tag: { $in: tags_in } } } },
                                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } }
                                            ]
                                        }
                                    ]
                                },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                            res.send(contents)
                        })
                })
            else if (authors.includes('all') && tags.includes('all')) 
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else 
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                { 'json.tag': { $nin: tags_ex } },
                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                            res.send(contents)
                        })
                })

            else if (!authors.includes('all')  && tags.includes('all')) 
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else 
                        db.collection('contents').find({
                            $and: [
                                { author: { $in : authors_in } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                { 'json.tag': { $nin: tags_ex } },
                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                            res.send(contents)
                        })
                })
        })
    }
}
