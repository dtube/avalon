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

        app.get('/proposal/votes/:id/:approves?', async (req,res) => {
            const id = req.params.id
            const appr = req.params.approves === 'true' ? true : (req.params.approves === 'false' ? false : null)
            if (!id || isNaN(parseInt(id)))
                return res.status(500).send({error: 'proposal id must be a valid integer'})
            let query = {proposal_id: parseInt(id)}
            if (typeof appr === 'boolean')
                query = {$and: [{proposal_id: parseInt(id)},{veto: !appr}]}
            try {
                res.send(await db.collection('proposalVotes').find(query).toArray())
            } catch (e) {
                return res.status(500).send({error: e.toString()})
            }
        })

        app.get('/proposal/votesByVoter/:voter/:approves?', async (req,res) => {
            const voter = req.params.voter
            const appr = req.params.approves === 'true' ? true : (req.params.approves === 'false' ? false : null)
            let query = {voter: voter}
            if (typeof appr === 'boolean')
                query = {$and: [{voter: voter},{veto: !appr}]}
            try {
                res.send(await db.collection('proposalVotes').find(query).toArray())
            } catch (e) {
                return res.status(500).send({error: e.toString()})
            }
        })
    }
}