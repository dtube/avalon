module.exports = {
    init: (app) => {
        app.get('/recover',(req,res) => {
            p2p.refresh(true)
            res.send({})
        })
    }
}