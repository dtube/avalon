const series = require('run-series')

module.exports = {
    init: (app) => {
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

                    series(executions, function (err, results) {
                        if (err) throw err
                        cb(null, results)
                    })
                }
                fillComments([post], function () {
                    res.send(post)
                })
            })
        })
    }
}
