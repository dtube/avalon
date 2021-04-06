module.exports = {
    init: (app) => {
        // generate a new key pair
        app.get('/newKeyPair', (req, res) => {
            res.send(chain.getNewKeyPair())
        })
    }
}
