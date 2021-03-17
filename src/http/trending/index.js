module.exports = {
    init: (app) => {
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
    }
}
