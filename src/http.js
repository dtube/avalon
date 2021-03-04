var http_port = process.env.HTTP_PORT || 3001
var express = require('express')
var cors = require('cors')
var bodyParser = require('body-parser')
const YT = require('simple-youtube-api')
const yt_key = process.env.YT_API_KEY || 'NO_KEY'
const yt = new YT(yt_key)
const { extract } = require('oembed-parser')
const ogs = require('open-graph-scraper')
const parallel = require('run-parallel')
const transaction = require('./transaction.js')
const timeout_transact_async = 7500

var http = {
    init: () => {
        var app = express()
        app.use(cors())
        app.use(bodyParser.json())

        // fetch a single block
        app.get('/block/:number', (req, res) => {
            var blockNumber = parseInt(req.params.number)
            db.collection('blocks').findOne({ _id: blockNumber }, function (err, block) {
                if (err) throw err
                if (!block) {
                    res.sendStatus(404)
                    return
                }
                res.send(block)
            })
        })

        // count how many blocks are in the node
        app.get('/count', (req, res) => {
            db.collection('blocks').countDocuments(function (err, count) {
                if (err) throw err
                res.send({
                    count: count
                })
            })
        })

        // check econ data
        app.get('/rewardPool', (req, res) => {
            if (eco.lastRewardPool)
                res.send(eco.lastRewardPool)
            else res.send({})
        })

        // get supply info
        app.get('/supply', (req, res) => {
            let executions = [
                (cb) => db.collection('accounts').aggregate([{ $group: { _id: 0, total: { $sum: "$balance" } } }]).toArray((e, r) => cb(e, r)),
                (cb) => db.collection('contents').aggregate([{ $unwind: "$votes" }, { $match: { "votes.claimed": { $exists: false } } }, { $group: { _id: 0, total: { $sum: "$votes.claimable" } } }]).toArray((e, r) => cb(e, r))
            ]

            parallel(executions, (e, r) => {
                if (e)
                    return res.sendStatus(500)

                var reply = {
                    circulating: r[0][0].total
                }
                if (r[1].length > 0) {
                    reply.unclaimed = r[1][0].total
                    reply.total = r[0][0].total + r[1][0].total
                }
                res.send(reply)
            })
        })

        // pending reward per user
        app.get('/rewards/pending/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            var claimableDate = new Date().getTime() - config.ecoClaimTime;
            db.collection('contents').aggregate([
                { $unwind: "$votes" },
                {
                    $match: {
                        "votes.ts": { $gte: claimableDate },
                        "votes.u": req.params.name,
                        "votes.claimed": { $exists: false }
                    }
                }, { $group: { _id: 0, total: { $sum: {$floor: "$votes.claimable" } } } }
            ]).toArray(function (err, result) {
                if (err) {
                    console.log(err)
                    res.sendStatus(500)
                    return
                } else {
                    if (!result[0] || !result[0].total) {
                        res.send({ total: 0 })
                        return
                    }
                    res.send({ total: Math.round(1000 * result[0].total) / 1000 })
                }
            })
        })

        // claimable reward per user
        app.get('/rewards/claimable/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            var claimableDate = new Date().getTime() - config.ecoClaimTime;
            db.collection('contents').aggregate([
                { $unwind: "$votes" },
                {
                    $match: {
                        "votes.ts": { $lt: claimableDate },
                        "votes.u": req.params.name,
                        "votes.claimed": { $exists: false }
                    }
                }, { $group: { _id: 0, total: { $sum: {$floor: "$votes.claimable" } } } }
            ]).toArray(function (err, result) {
                if (err) {
                    console.log(err)
                    res.sendStatus(500)
                    return
                } else {
                    if (!result[0] || !result[0].total) {
                        res.send({ total: 0 })
                        return
                    }
                    res.send({ total: Math.round(1000 * result[0].total) / 1000 })
                }
            })
        })
        // claimed reward per user
        app.get('/rewards/claimed/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('contents').aggregate([
                { $unwind: "$votes" },
                {
                    $match: {
                        "votes.u": req.params.name,
                        "votes.claimed": { $exists: true }
                    }
                }, { $group: { _id: 0, total: { $sum: {$floor: "$votes.claimable" } } } }
            ]).toArray(function (err, result) {
                if (err) {
                    console.log(err)
                    res.sendStatus(500)
                    return
                } else {
                    if (!result[0] || !result[0].total) {
                        res.send({ total: 0 })
                        return
                    }
                    res.send({ total: Math.round(1000 * result[0].total) / 1000 })
                }
            })
        })

        // generate a new key pair
        app.get('/newKeyPair', (req, res) => {
            res.send(chain.getNewKeyPair())
        })

        // this suggests the node to produce a block and submit it
        app.get('/mineBlock', (req, res) => {
            delete p2p.recovering
            res.send(chain.getLatestBlock()._id.toString())
            chain.mineBlock(function (error, finalBlock) {
                if (error)
                    logr.error('ERROR refused block', finalBlock)
            })
        })

        // add data to the upcoming transactions pool
        app.post('/transact', (req, res) => {
            var tx = req.body
            if (!tx) {
                res.sendStatus(500)
                return
            }
            transaction.isValid(tx, new Date().getTime(), function (isValid, errorMessage) {
                if (!isValid) {
                    logr.trace('invalid http tx: ', errorMessage, tx)
                    res.status(500).send({ error: errorMessage })
                } else {
                    p2p.broadcast({ t: 5, d: tx })
                    transaction.addToPool([tx])
                    res.send(chain.getLatestBlock()._id.toString())
                }
            })
        })

        // add data to the upcoming transactions pool
        // and return only when the transaction is in a finalized block
        app.post('/transactWaitConfirm', (req, res) => {
            var tx = req.body
            if (!tx) {
                res.sendStatus(500)
                return
            }
            transaction.isValid(tx, new Date().getTime(), function (isValid, errorMessage) {
                if (!isValid) {
                    logr.trace('invalid http tx: ', errorMessage, tx)
                    res.status(500).send({ error: errorMessage })
                } else {
                    p2p.broadcast({ t: 5, d: tx })
                    transaction.addToPool([tx])

                    var transactTimeout = setTimeout(function () {
                        transaction.eventConfirmation.removeListener(tx.hash, () => { })
                        res.status(408).send({ error: 'transaction timeout' })
                    }, timeout_transact_async)

                    transaction.eventConfirmation.addListener(tx.hash, function () {
                        clearTimeout(transactTimeout)
                        res.send(chain.getLatestBlock()._id.toString())
                    })
                }
            })
        })

        // list connected peers
        app.get('/peers', (req, res) => {
            var peers = []
            for (let i = 0; i < p2p.sockets.length; i++) {
                var peer = {
                    ip: p2p.sockets[i]._socket.remoteAddress,
                    port: p2p.sockets[i]._socket.remotePort,
                }
                if (p2p.sockets[i].node_status)
                    peer.node_status = p2p.sockets[i].node_status
                if (p2p.sockets[i].sentUs)
                    peer.sentUs = p2p.sockets[i].sentUs

                peers.push(peer)
            }
            res.send(peers)
        })

        // connect to a new peer
        app.post('/addPeer', (req, res) => {
            p2p.connect([req.body.peer])
            res.send()
        })

        // look at the miner schedule
        app.get('/schedule', (req, res) => {
            res.send(chain.schedule)
        })

        // get full list of ranked miners
        app.get('/allminers', (req, res) => {
            db.collection('accounts').find({ node_appr: { $gt: 0 } }, {
                sort: { node_appr: -1 }
            }).toArray(function (err, accounts) {
                if (err) throw err
                res.send(accounts)
            })
        })

        // get in-memory data (intensive)
        app.get('/debug', (req, res) => {
            res.send({
                mempool: transaction.pool,
                consensus: {
                    possBlocks: consensus.possBlocks,
                    processed: consensus.processed,
                    validating: consensus.validating,
                },
                p2p: {
                    recoveringBlocks: p2p.recoveringBlocks,
                    // recoveredBlocks: p2p.recoveredBlocks
                },
                chain: {
                    recentBlocks: chain.recentBlocks,
                    recentTxs: chain.recentTxs
                }
            })
        })

        // get hot
        app.get('/hot', (req, res) => {
            res.send(rankings.contents.hot.slice(0, 50))
        })
        app.get('/hot/:author/:link', (req, res) => {
            var filteredContents = []
            var isPastRelativeContent = false
            var added = 0
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

        // get trending
        app.get('/trending', (req, res) => {
            res.send(rankings.contents.trending.slice(0, 50))
        })
        app.get('/trending/:author/:link', (req, res) => {
            var filteredContents = []
            var isPastRelativeContent = false
            var added = 0
            for (let i = 0; i < rankings.contents.trending.length; i++) {
                if (isPastRelativeContent) {
                    filteredContents.push(rankings.contents.trending[i])
                    added++
                }
                if (added >= 50) break
                if (rankings.contents.trending[i].author === req.params.author
                    && rankings.contents.trending[i].link === req.params.link)
                    isPastRelativeContent = true
            }
            res.send(filteredContents)
        })

        // get new contents
        app.get('/new', (req, res) => {
            db.collection('contents').find({ pa: null }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                res.send(contents)
            })
        })
        app.get('/new/:author/:link', (req, res) => {
            db.collection('contents').findOne({
                $and: [
                    { author: req.params.author },
                    { link: req.params.link }
                ]
            }, function (err, content) {
                if (!content) {
                    res.sendStatus(404)
                    return
                }
                db.collection('contents').find({
                    $and: [
                        { pa: null },
                        { ts: { $lte: content.ts } }
                    ]
                }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                    res.send(contents)
                })
            })
        })

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

        // get blog of user
        app.get('/blog/:username', (req, res) => {
            var username = req.params.username
            db.collection('contents').find({ pa: null, author: username }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
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

        // account history api
        app.get('/history/:author/:lastBlock', (req, res) => {
            var lastBlock = parseInt(req.params.lastBlock)
            var author = req.params.author
            var query = {
                $and: [
                    {
                        $or: [
                            { 'txs.sender': author },
                            { 'txs.data.target': author },
                            { 'txs.data.receiver': author },
                            { 'txs.data.pa': author },
                            { 'txs.data.author': author }
                        ]
                    }
                ]
            }
            if (lastBlock > 0)
                query['$and'].push({ _id: { $lt: lastBlock } })

            db.collection('blocks').find(query, { sort: { _id: -1 }, limit: 50 }).toArray(function (err, blocks) {
                for (let b = 0; b < blocks.length; b++) {
                    var newTxs = []
                    for (let t = 0; t < blocks[b].txs.length; t++)
                        if (blocks[b].txs[t].sender === author
                            || blocks[b].txs[t].data.target === author
                            || blocks[b].txs[t].data.receiver === author
                            || blocks[b].txs[t].data.pa === author
                            || blocks[b].txs[t].data.author === author)
                            newTxs.push(blocks[b].txs[t])
                    blocks[b].txs = newTxs
                }
                res.send(blocks)
            })
        })

        // get votes history of a user
        app.get('/votes/all/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var query = {
                $and: [{
                    'votes.u': voter,
                }]
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
                for (let i = 0; i < contents.length; i++) {
                    for (let y = 0; y < contents[i].votes.length; y++) {
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                    }
                }
                res.send(votes)
            })
        })
        // adding back this one for compatibility purpose
        // to remove in future
        app.get('/votes/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var query = {
                $and: [{
                    'votes.u': voter,
                }]
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
                for (let i = 0; i < contents.length; i++) {
                    for (let y = 0; y < contents[i].votes.length; y++) {
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                    }
                }
                res.send(votes)
            })
        })

        // get pending votes history of a user
        app.get('/votes/pending/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var claimableDate = new Date().getTime() - config.ecoClaimTime;
            var query =
            {
                $and: [{}],
                votes:
                {
                    $elemMatch: {
                        u: voter,
                        ts: { $gt: claimableDate }
                    }
                }
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })

            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
                for (let i = 0; i < contents.length; i++) {
                    for (let y = 0; y < contents[i].votes.length; y++) {
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                    }
                }
                res.send(votes)
            })
        })

        // get claimable votes history of a user
        app.get('/votes/claimable/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var claimableDate = new Date().getTime() - config.ecoClaimTime;
            var query =
            {
                $and: [{}],
                votes:
                {
                    $elemMatch: {
                        u: voter,
                        claimable: { $gte: 1 },
                        claimed: { $exists: false },
                        ts: { $lt: claimableDate }
                    }
                }
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })
            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
                for (let i = 0; i < contents.length; i++) {
                    for (let y = 0; y < contents[i].votes.length; y++) {
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                    }
                }
                res.send(votes)
            })
        })

        // get claimed votes history of a user
        app.get('/votes/claimed/:voter/:lastTs', (req, res) => {
            var voter = req.params.voter
            var query =
            {
                $and: [{}],
                votes:
                {
                    $elemMatch: {
                        u: voter,
                        claimable: { $gte: 1 },
                        claimed: { $exists: true }
                    }
                }
            }
            var lastTs = parseInt(req.params.lastTs)
            if (lastTs > 0)
                query['$and'].push({ ts: { $lt: lastTs } })
            db.collection('contents').find(query, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                if (err) throw err
                var votes = []
                for (let i = 0; i < contents.length; i++) {
                    for (let y = 0; y < contents[i].votes.length; y++) {
                        if (contents[i].votes[y].u === voter)
                            votes.push({
                                author: contents[i].author,
                                link: contents[i].link,
                                claimable: contents[i].votes[y].claimable,
                                claimed: contents[i].votes[y].claimed,
                                vt: contents[i].votes[y].vt,
                                ts: contents[i].votes[y].ts,
                                contentTs: contents[i].ts,
                                burn: contents[i].votes[y].burn
                            })
                    }
                }
                res.send(votes)
            })
        })

        // get new contents
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
                    var executions = []
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

        // get current chain config
        app.get('/config', (req, res) => {
            res.send(config)
        })

        // get username price
        app.get('/accountPrice/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (account) res.send('Not Available')
                else res.send(String(eco.accountPrice(req.params.name)))
            })
        })

        // get account info
        app.get('/account/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account) res.sendStatus(404)
                else res.send(account)
            })
        })

        // get accounts info
        app.get('/accounts/:names', (req, res) => {
            if (!req.params.names || typeof req.params.names !== 'string') {
                res.sendStatus(500)
                return
            }
            var names = req.params.names.split(',', 100)
            db.collection('accounts').find({ name: { $in: names } }).toArray(function (err, accounts) {
                if (!accounts) res.sendStatus(404)
                else {
                    for (let i = 0; i < accounts.length; i++) {
                        accounts[i].followsCount = (accounts[i].follows ? accounts[i].follows.length : 0)
                        accounts[i].followersCount = (accounts[i].followers ? accounts[i].followers.length : 0)
                        delete accounts[i].follows
                        delete accounts[i].followers
                    }
                    res.send(accounts)
                }
            })
        })

        // get follows
        app.get('/follows/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account) res.sendStatus(404)
                else
                    if (account.follows)
                        res.send(account.follows)
                    else
                        res.send([])

            })
        })

        // get followers
        app.get('/followers/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account) res.sendStatus(404)
                else
                    if (account.followers)
                        res.send(account.followers)
                    else
                        res.send([])

            })
        })

        // get notifications for a user
        app.get('/notifications/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('notifications').find({ u: req.params.name }, { sort: { ts: -1 }, limit: 200 }).toArray(function (err, notifs) {
                if (!notifs) res.sendStatus(404)
                else res.send(notifs)
            })
        })

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

        // 3rd party video embed data
        // get youtube info
        app.get('/youtube/:videoId', (req, res) => {
            if (!req.params.videoId) {
                res.sendStatus(500)
                return
            }
            yt.getVideoByID(req.params.videoId).then(function (video) {
                video.duration = video.durationSeconds
                res.send(video)
            }).catch(function (err) {
                logr.warn('YouTube API error', err)
                res.sendStatus(500)
            })
        })

        // get oembed for any url
        app.get('/oembed/:url', (req, res) => {
            if (!req.params.url) {
                res.sendStatus(500)
                return
            }
            extract(req.params.url).then((data) => {
                res.send(data)
            }).catch(() => {
                res.sendStatus(404)
            })
        })

        // get open graph data for any url
        app.get('/opengraph/:url', (req, res) => {
            if (!req.params.url) {
                res.sendStatus(500)
                return
            }
            ogs({ url: req.params.url, headers: { 'user-agent': 'facebookexternalhit/1.1 (+https://d.tube)' } }, function (error, results) {
                if (error) res.sendStatus(404)
                else res.send(results)
            })
        })

        app.listen(http_port, () => logr.info('Listening http on port: ' + http_port))
    }
}

module.exports = http
