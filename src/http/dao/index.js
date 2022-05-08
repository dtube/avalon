const dao = require("../../dao")
const daoMaster = require('../../daoMaster')

module.exports = {
    init: (app) => {
        app.get('/dao',(req,res) => {
            res.send({
                nextID: dao.nextID,
                lastID: dao.lastID,
                activeProposals: dao.activeProposalIDs
            })
        })

        app.get('/dao/master',(req,res) => {
            res.send({
                nextID: daoMaster.nextID,
                lastID: daoMaster.lastID,
            })
        })

        app.get('/dao/master/op/:id', async (req,res) => {
            const id = req.params.id
            if (!id || isNaN(parseInt(id)))
                return res.status(500).send({error: 'op id must be a valid integer'})
            let op
            try {
                op = await db.collection('masterdao').findOne({_id: parseInt(id)})
            } catch (e) {
                return res.status(500).send({error: e.toString()})
            }
            if (!op)
                return res.status(404).send({error: 'master dao operation not found'})
            else
                return res.send(op)
        })

        app.get('/dao/master/ops/:status/:skip?', async (req,res) => {
            const status = req.params.status
            const query = {$and: []}
            const sort = {}
            switch (status) {
                case 'queued':
                    query.$and.push({executed: {$exists: false}})
                    query.$and.push({expiration: {$gt: new Date().getTime()}})
                    sort.ts = -1
                    break
                case 'expired':
                    query.$and.push({executed: {$exists: false}})
                    query.$and.push({expiration: {$lte: new Date().getTime()}})
                    sort.ts = -1
                    break
                case 'executed':
                    query.$and.push({executed: {$exists: true}})
                    query.$and.push({error: {$exists: false}})
                    sort.executed = -1
                    break
                case 'errored':
                    query.$and.push({executed: {$exists: true}})
                    query.$and.push({error: {$exists: true}})
                    sort.executed = -1
                    break
                default:
                    return res.status(400).send({error: 'invalid status'})
            }
            try {
                res.send(await db.collection('masterdao').find(query,{limit: 50, skip: parseInt(req.params.skip) || 0, sort: sort}).toArray())
            } catch (e) {
                res.status(500).send({error: e.toString()})
            }
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