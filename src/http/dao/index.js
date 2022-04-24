const dao = require("../../dao")

module.exports = {
    init: (app) => {
        app.get('/dao',(req,res) => {
            res.send({
                nextID: dao.nextID,
                lastID: dao.lastID,
                activeProposals: dao.activeProposalIDs
            })
        })
    }
}