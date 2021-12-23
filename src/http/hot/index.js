module.exports = {
    init: (app) => {
        /**
         * @api {get} /hot Hot
         * @apiName hot
         * @apiGroup Rankings
         * 
         * @apiSuccess {Object[]} contents List of ranked hot contents
         */
        app.get('/hot', (req, res) => {
            res.send(rankings.contents.hot.slice(0, 50))
        })

        /**
         * @api {get} /hot/:author/:link Hot (continued)
         * @apiName hotContinued
         * @apiGroup Rankings
         * 
         * @apiParam {String} author Author of post to continue from
         * @apiParam {String} link Permlink of post to continue from
         * 
         * @apiSuccess {Object[]} contents List of ranked hot contents continued
         */
        app.get('/hot/:author/:link', (req, res) => {
            let filteredContents = []
            let isPastRelativeContent = false
            let added = 0
            for (let i = 0; i < rankings.contents.hot.length; i++) {
                if (isPastRelativeContent) {
                    filteredContents.push(rankings.contents.hot[i])
                    added++
                }
                if (added >= 50) break
                if (rankings.contents.hot[i].author === req.params.author
                    && rankings.contents.hot[i].link === req.params.link)
                    isPastRelativeContent = true
            }
            res.send(filteredContents)
        })

        // get hot with tags and limit filter
        /**
         * @api {get} /hot Hot Filtered
         * @apiName hotFiltered
         * @apiGroup Rankings
         * 
         * @apiParam {String} filter Filter parameters
         * 
         * @apiSuccess {Object[]} contents List of ranked hot contents filtered
         */
        app.get('/hot/:filter', (req, res) => {
            let filterParam = req.params.filter
            let filter = filterParam.split(':')
            let filterBy = filter[1]
            let filterAttrs = filterBy.split('&')

            let filterMap = {}
            let defaultKeys = ['tags', 'limit']
            let filterKeys = []

            for (let k=0; k<filterAttrs.length; k++) {
                let kv = filterAttrs[k].split('=')

                if (kv.length === 2) {
                    let key = kv[0]
                    filterKeys.push(key)
                    let val = kv[1]

                    if (key === 'tags') 
                        filterMap['tags'] = val.split(',')
                    else if (key === 'limit') 
                        filterMap['limit'] = parseInt(val)
                }
            }

            for (let k=0; k<defaultKeys.length; k++) {
                let key = defaultKeys[k]

                if (!filterKeys.includes(key)) 
                    if (key === 'tags') {
                        filterMap['tags'] = []
                        filterMap['tags'].push('all')
                    } else if (key === 'limit') 
                        filterMap['limit'] = Number.MAX_SAFE_INTEGER
            }

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
            let minTs = new Date().getTime() - rankings.types['hot'].halfLife*rankings.expireFactor
            if (tags.includes('all')) 
                db.collection('contents').find(
                    {
                        $and: [
                            { pa: null },
                            { 'json.tag': { $nin: tags_ex } },
                            { votes: { $elemMatch: { tag: { $nin: tags_ex } } } },
                            { ts: {'$gt': minTs} }
                        ]
                    },
                    {sort: {ts: -1}}).toArray(function(err, contents) {
                    for (let i = 0; i < contents.length; i++) {
                        contents[i].score = 0
                        contents[i].ups = 0
                        contents[i].downs = 0
                        if (!contents[i].dist) contents[i].dist = 0
                        for (let y = 0; y < contents[i].votes.length; y++) {
                            if (contents[i].votes[y].vt > 0)
                                contents[i].ups += Math.abs(contents[i].votes[y].vt)
                            if (contents[i].votes[y].vt < 0)
                                contents[i].downs += Math.abs(contents[i].votes[y].vt)
                        }
                        contents[i].score = rankings.types['hot'].score(contents[i].ups, contents[i].downs, new Date(contents[i].ts))
                    }
                    contents = contents.sort(function(a,b) {
                        return b.score - a.score
                    })
                    res.send(contents.slice(0, limit))
                })
            else 
                db.collection('contents').find(
                    {
                        $and: [
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
                            { ts: {'$gt': minTs} }
                        ]
                    },
                    {sort: {ts: -1}}).toArray(function(err, contents) {
                    for (let i = 0; i < contents.length; i++) {
                        contents[i].score = 0
                        contents[i].ups = 0
                        contents[i].downs = 0
                        if (!contents[i].dist) contents[i].dist = 0
                        for (let y = 0; y < contents[i].votes.length; y++) {
                            if (contents[i].votes[y].vt > 0)
                                contents[i].ups += Math.abs(contents[i].votes[y].vt)
                            if (contents[i].votes[y].vt < 0)
                                contents[i].downs += Math.abs(contents[i].votes[y].vt)
                        }
                        contents[i].score = rankings.types['hot'].score(contents[i].ups, contents[i].downs, new Date(contents[i].ts))
                    }
                    contents = contents.sort(function(a,b) {
                        return b.score - a.score
                    })
                    //rankings.contents['hot'] = contents
                    res.send(contents.slice(0, limit))
                })
        })
    }
}
