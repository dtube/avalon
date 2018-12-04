var http_port = process.env.HTTP_PORT || 3001;
var express = require("express")
var cors = require('cors')
var bodyParser = require('body-parser')
var decay = require('decay')
var hotScore = decay.redditHot();
var fetchVideoInfo = require('youtube-info');
const series = require('run-series')
const transaction = require('./transaction.js')
const eco = require('./economics.js')

var http = {
    rankings: {
        hot: []
    },
    generateHot: function(cb) {
        db.collection('contents').find({pa: null}, {sort: {_id: -1}}).toArray(function(err, contents) {
            for (let i = 0; i < contents.length; i++) {
                contents[i].score = 0
                contents[i].ups = 0
                contents[i].downs = 0
                if (!contents[i].votes) {
                    continue
                }
                for (let y = 0; y < contents[i].votes.length; y++) {
                    if (contents[i].votes[y].vt > 0)
                        contents[i].ups += Math.abs(contents[i].votes[y].vt)
                    if (contents[i].votes[y].vt < 0)
                        contents[i].downs += Math.abs(contents[i].votes[y].vt)
                }
                contents[i].score = hotScore(contents[i].ups, contents[i].downs, contents[i]._id.getTimestamp())
            }
            contents = contents.sort(function(a,b) {
                return b.score - a.score
            })
            http.rankings.hot = contents
            cb()
        })
    },
    newRankingContent: function(content) {
        var alreadyAdded = false
        for (let i = 0; i < http.rankings.hot.length; i++) {
            if (content.author == http.rankings.hot[i].author && content.link == http.rankings.hot[i].link) {
                alreadyAdded = true
                http.rankings.hot[i].json = content.json
                break
            }
        }

        if (!alreadyAdded) {
            content._id = Math.floor(new Date().getTime() / 1000).toString(16) + "0000000000000000"
            http.rankings.hot.push(content)
        }
    },
    updateRankings: function(author, link, vote) {
        newRankings = []
        for (let i = 0; i < http.rankings.hot.length; i++) {
            var ts = parseInt(http.rankings.hot[i]._id.substring(0, 8), 16) * 1000
            if (http.rankings.hot[i].author == author && http.rankings.hot[i].link == link) {
                if (vote.vt > 0)
                    http.rankings.hot[i].ups += Math.abs(vote.vt)
                if (vote.vt < 0)
                    http.rankings.hot[i].downs += Math.abs(vote.vt)
                http.rankings.hot[i].score = hotScore(http.rankings.hot[i].ups, http.rankings.hot[i].downs, new Date(ts))
            }
            if (ts > new Date().getTime() - 7*24*60*60*1000)
                newRankings.push(http.rankings.hot[i])
        }
        http.rankings.hot = newRankings.sort(function(a,b) {
            return b.score - a.score
        })
    },
    init: () => {
        var app = express()
        app.use(cors())
        app.use(bodyParser.json());

        // fetch a single block
        app.get('/block/:number', (req, res) => {
            var blockNumber = parseInt(req.params.number)
            db.collection('blocks').findOne({_id: blockNumber}, function(err, block) {
                if (err) throw err;
                res.send(block)
            })
        });
        
        // count how many blocks are in the node
        app.get('/count', (req, res) => {
            db.collection('blocks').countDocuments(function(err, count) {
                if (err) throw err;
                res.send({
                    count: count
                })
            })
        });

        // check econ data
        app.get('/rewardPool', (req, res) => {
            eco.rewardPool(function(rp) {
                res.send(rp)
            })
        });

        // generate a new key pair
        app.get('/newKeyPair', (req, res) => {
            res.send(chain.getNewKeyPair())
        });

        // this suggests the node to produce a block and submit it
        app.get('/mineBlock', (req, res) => {
            delete p2p.recovering
            res.send(chain.getLatestBlock()._id.toString())
            chain.mineBlock(function(error, finalBlock) {
                if (error)
                    logr.error('ERROR refused block', finalBlock)
            })
        });

        // add data to the upcoming transactions pool
        app.post('/transact', (req, res) => {
            var tx = req.body
            if (!tx) {
                res.sendStatus(500)
                return
            }
            transaction.isValid(tx, new Date().getTime(), function(isValid) {
                if (!isValid) {
                    logr.warn('Invalid tx', tx)
                    res.sendStatus(500)
                } else {
                    p2p.broadcast({t:5, d:tx})
                    transaction.addToPool([tx])
                    res.send(chain.getLatestBlock()._id.toString());
                }
            })
        });

        // list connected peers
        app.get('/peers', (req, res) => {
            res.send(p2p.sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
        });
        
        // connect to a new peer
        app.post('/addPeer', (req, res) => {
            p2p.connect([req.body.peer]);
            res.send();
        });

        // look at the miner schedule
        app.get('/schedule', (req, res) => {
            res.send(chain.schedule);
        });

        // get hot
        app.get('/hot', (req, res) => {
            if (!http.rankings.hot) {
                http.generateHot(function() {
                    res.send(http.rankings.hot.slice(0,50))
                })
            } else {
                res.send(http.rankings.hot.slice(0,50))
            }
        })
        app.get('/hot/:author/:link', (req, res) => {
            var filteredContents = []
            var isPastRelativeContent = false
            var added = 0
            for (let i = 0; i < http.rankings.hot.length; i++) {
                if (isPastRelativeContent) {
                    filteredContents.push(http.rankings.hot[i])
                    added++
                }
                if (added >= 50) break
                if (http.rankings.hot[i].author == req.params.author
                && http.rankings.hot[i].link == req.params.link)
                    isPastRelativeContent = true
            }
            res.send(filteredContents)
        })

        // get new contents
        app.get('/new', (req, res) => {
            db.collection('contents').find({pa: null}, {sort: {_id: -1}, limit: 50}).toArray(function(err, contents) {
                res.send(contents)
            })
        })
        app.get('/new/:author/:link', (req, res) => {
            db.collection('contents').findOne({
            $and: [
                {author: req.params.author}, 
                {link: req.params.link}
            ]}, function(err, content) {
                db.collection('contents').find({
                $and: [
                    {pa: null},
                    {_id: {$lt: content._id}}
                ]}, {sort: {_id: -1}, limit: 50}).toArray(function(err, contents) {
                    res.send(contents)
                })
            })
        })

        // get feed contents
        app.get('/feed/:username', (req, res) => {
            db.collection('accounts').findOne({name: req.params.username}, function(err, account) {
                db.collection('contents').find({
                $and: [
                    {author: {$in: account.follows}},
                    {pa: null}
                ]}, {sort: {_id: -1}, limit: 50}).toArray(function(err, contents) {
                    res.send(contents)
                })
            })
        })
        app.get('/feed/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
            $and: [
                {author: req.params.author}, 
                {link: req.params.link}
            ]}, function(err, content) {
                db.collection('accounts').findOne({name: req.params.username}, function(err, account) {
                    db.collection('contents').find({
                    $and: [
                        {author: {$in: account.follows}},
                        {pa: null},
                        {_id: {$lt: content._id}}
                    ]}, {sort: {_id: -1}, limit: 50}).toArray(function(err, contents) {
                        res.send(contents)
                    })
                })
            })
        })

        // get blog of user
        app.get('/blog/:username', (req, res) => {
            var username = req.params.username
            db.collection('contents').find({pa: null, author: username}, {sort: {_id: -1}, limit: 50}).toArray(function(err, contents) {
                res.send(contents)
            })
        })
        app.get('/blog/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
            $and: [
                {author: req.params.author}, 
                {link: req.params.link}
            ]}, function(err, content) {
                var username = req.params.username
                db.collection('contents').find({
                $and: [
                    {pa: null},
                    {author: username},
                    {_id: {$lt: content._id}}
                ]}, {sort: {_id: -1}, limit: 50}).toArray(function(err, contents) {
                    res.send(contents)
                })
            })
        })

        // account history api
        app.get('/blog/:author/history/:lastBlock', (req, res) => {
            var lastBlock = parseInt(req.params.lastBlock)
            var author = req.params.author
            var query = {
                $and: [
                    { $or: [
                        {'txs.sender': author},
                        {'txs.data.target': author},
                        {'txs.data.receiver': author},
                        {'txs.data.pa': author},
                        {'txs.data.author': author}
                    ]}
                ]
            }
            if (lastBlock > 0) {
                query['$and'].push({_id: {$lt: lastBlock}})
            }
            db.collection('blocks').find(query, {sort: {_id: -1}, limit: 50}).toArray(function(err, blocks) {
                res.send(blocks)
            })
        })

        // get new contents
        app.get('/content/:author/:link', (req, res) => {
            if (!req.params.author || typeof req.params.link !== 'string') {
                res.sendStatus(500);
                return
            }
            db.collection('contents').findOne({
                author: req.params.author,
                link: req.params.link
            }, function(err, post) {
                if (!post) {
                    res.sendStatus(404)
                    return
                }
                if (!post.child || post.child.length == 0) {
                    res.send(post)
                    return
                }
                var tmpPost = post
                post.comments = {}
                //post.comments[post.author+'/'+post.link] = tmpPost
                function fillComments(posts, cb) {
                    if (!posts || posts.length == 0) {
                        cb(null, posts)
                        return
                    }
                    var executions = []
                    for (let i = 0; i < posts.length; i++) {
                        executions.push(function(callback) {
                            db.collection('contents').find({
                                pa: posts[i].author,
                                pp: posts[i].link
                            }).toArray(function(err, comments) {
                                for (let y = 0; y < comments.length; y++)
                                    post.comments[comments[y].author+'/'+comments[y].link] = comments[y]
                                fillComments(comments, function(err, comments) {
                                    callback(null, true)
                                })
                            })
                            i++
                        })
                    }
                    var i = 0
                    series(executions, function(err, results) {
                        if (err) throw err;
                        cb(null, results)
                    })
                }
                fillComments([post], function(err, results) {
                    res.send(post)
                })
            })
        })

        // get account info
        app.get('/account/:name', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500);
                return
            }
            db.collection('accounts').findOne({name: req.params.name}, function(err, account) {
                if (!account) res.sendStatus(404)
                else res.send(account)
            })
        })

        // get accounts info
        app.get('/accounts/:names', (req, res) => {
            if (!req.params.names || typeof req.params.names !== 'string') {
                res.sendStatus(500);
                return
            }
            names = req.params.names.split(',', 100)
            db.collection('accounts').find({name: {$in: names}}).toArray(function(err, accounts) {
                if (!accounts) res.sendStatus(404)
                else res.send(accounts)
            })
        })

        // test api (should be separated)
        // get youtube info
        app.get('/youtube/:videoId', (req, res) => {
            if (!req.params.videoId) {
                res.sendStatus(500);
                return
            }
            fetchVideoInfo(req.params.videoId, function(err, videoInfo) {
                res.send(videoInfo)
            });
        })

        app.listen(http_port, () => logr.info('Listening http on port: ' + http_port));
    }
}

module.exports = http