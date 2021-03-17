module.exports = {
    init: (app) => {
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
    }
}
