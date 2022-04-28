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

        app.get('/dao/:state/:type/:sort?', async (req,res) => {
            const state = req.params.state
            const type = req.params.type
            let sort = -1
            const query = {$and: []}
            if (type !== 'all')
                query.$and.push({type: parseInt(type)})
            if (state !== 'all')
                query.$and.push({state: parseInt(state)})
            if (query.$and.length === 0)
                delete query.$and
            if (req.params.sort === 'asc')
                sort = 1
            try {
                res.send(await db.collection('proposals').find(query,{sort:{_id:sort}}).toArray())
            } catch (e) {
                res.status(500).send({error: e.toString()})
            }
        })
    }
}