const dao = require("../../dao")

module.exports = {
    init: (app) => {
        app.get('/proposal/:id', async (req,res) => {
            const id = req.params.id
            if (!id || isNaN(parseInt(id)))
                return res.status(500).send({error: 'proposal id must be a valid integer'})
            let proposal
            try {
                proposal = await db.collection('proposals').findOne({_id: parseInt(id)})
            } catch (e) {
                return res.status(500).send({error: e.toString()})
            }
            if (!proposal)
                return res.status(404).send({error: 'proposal not found'})
            else
                return res.send(proposal)
        })
    }
}