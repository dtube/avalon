const parallel = require('run-parallel')

module.exports = {
    init: (app) => {
        /**
         * @api {get} /content/:author/:link Content Info
         * @apiName content
         * @apiGroup Contents
         * 
         * @apiParam {String} author Content author
         * @apiParam {String} link Content permlink
         * 
         * @apiSuccess {String} _id Content identifier
         * @apiSuccess {String} author Content author
         * @apiSuccess {String} link Content permlink
         * @apiSuccess {String} [pa] Parent author
         * @apiSuccess {String} [pp] Parent permlink
         * @apiSuccess {Array} child List of children of content
         * @apiSuccess {Array} votes Content votes
         * @apiSuccess {Object[]} votes Complete list of votes made by voter
         * @apiSuccess {String} votes.u Username of voter
         * @apiSuccess {Double} votes.claimable Amount claimable from vote
         * @apiSuccess {Double} [votes.claimed] Timestamp of when the curation rewards from the vote was claimed
         * @apiSuccess {Integer} votes.vt VP spent on vote
         * @apiSuccess {Integer} votes.ts Timestamp of when the vote was casted
         * @apiSuccess {String} [votes.tag] Tag associated with the vote
         * @apiSuccess {Integer} ts Timestamp at content creation
         * @apiSuccess {Object} tags Content tags and its corresponding VP spent
         * @apiSuccess {Double} dist Total curation rewards distributed in terms of 0.01 DTUBE
         * @apiSuccess {Object} comments Details of all comments
         */
        app.get('/content/:author/:link', (req, res) => {
            if (!req.params.author || typeof req.params.link !== 'string') {
                res.sendStatus(500)
                return
            }
            db.collection('contents').findOne({
                author: req.params.author,
                link: req.params.link
            }, function (err, post) {
                if (!post) {
                    res.sendStatus(404)
                    return
                }
                if (!post.child || post.child.length === 0) {
                    res.send(post)
                    return
                }
                post.comments = {}
                function fillComments(posts, cb) {
                    if (!posts || posts.length === 0) {
                        cb()
                        return
                    }
                    let executions = []
                    for (let i = 0; i < posts.length; i++)
                        executions.push(function (callback) {
                            db.collection('contents').find({
                                pa: posts[i].author,
                                pp: posts[i].link
                            }).toArray(function (err, comments) {
                                for (let y = 0; y < comments.length; y++)
                                    post.comments[comments[y].author + '/' + comments[y].link] = comments[y]
                                fillComments(comments, function () {
                                    callback(null, true)
                                })
                            })
                            i++
                        })

                    parallel(executions, function (err, results) {
                        if (err) throw err
                        cb(null, results)
                    })
                }
                fillComments([post], function () {
                    res.send(post)
                })
            })
        })

        // get content by tag with limit by certain author
        // filter = author,tag,limit,ts(from, to)
        // $API_URL/filter?author=author1,author2,...,authorN&tag=tag1,tag2,...,tagN&limit=x&ts=tsfrom-tsto
        /**
         * @api {get} /content/:filter Content with Filter
         * @apiName contentFiltered
         * @apiGroup Contents
         * 
         * @apiParam {String} filter Filter parameters
         * 
         * @apiSuccess {Array} contents List of filtered contents authored by username
         */
        app.get('/content/:filter', (req, res) => {
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
                        filterMap['limit'] = Number.MAX_SAFE_INTEGER
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
                db.collection('contents').find({
                    $and: [
                        { author: { $nin : authors_ex } },
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
                        { ts: { $lte: tsto } }
                    ]
                }, { sort: {ts:-1}, limit: limit}).toArray(function (err, contents) {
                    res.send(contents)
                })
            else if (!authors.includes('all') && !tags.includes('all')) 
                db.collection('contents').find({
                    $and: [
                        { author: { $in : authors_in } },
                        { author: { $nin : authors_ex } },
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
                        { ts: { $lte: tsto } }
                    ]
                }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                    res.send(contents)
                })
            else if (authors.includes('all') && tags.includes('all')) 
                db.collection('contents').find({
                    $and: [
                        { author: { $nin : authors_ex } },
                        { 'json.tag': { $nin: tags_ex } },
                        { votes: { $elemMatch: { tag: { $nin: tags_ex } } } },
                        { ts: { $gte: tsfrom } },
                        { ts: { $lte: tsto } }
                    ]
                }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                    res.send(contents)
                })
            else if (!authors.includes('all')  && tags.includes('all')) 
                db.collection('contents').find({
                    $and: [
                        { author: { $in : authors_in } },
                        { author: { $nin : authors_ex } },
                        { 'json.tag': { $nin: tags_ex } },
                        { votes: { $elemMatch: { tag: { $nin: tags_ex } } } },
                        { ts: { $gte: tsfrom } },
                        { ts: { $lte: tsto } }
                    ]
                }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                    res.send(contents)
                })
        })
    }
}
