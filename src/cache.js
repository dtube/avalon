const parallel = require('run-parallel')
const cloneDeep = require('clone-deep')
const ProcessingQueue = require('./processingQueue')
const txHistory = require('./txHistory')
let cache = {
    copy: {
        accounts: {},
        contents: {},
        distributed: {},
        proposals: {},
        playlists: {},
        masterdao: {},
        state: {}
    },
    accounts: {},
    contents: {},
    distributed: {},
    proposals: {},
    playlists: {},
    masterdao: {},
    state: {},
    changes: [],
    inserts: [],
    rebuild: {
        changes: [],
        inserts: []
    },
    leaders: {},
    leaderChanges: [],
    writerQueue: new ProcessingQueue(),
    rollback: function() {
        // rolling back changes from copied documents
        for (let c in cache.copy) {
            for (const key in cache.copy[c])
                cache[c][key] = cloneDeep(cache.copy[c][key])
            cache.copy[c] = {}
        }
        cache.changes = []

        // and discarding new inserts
        for (let i = 0; i < cache.inserts.length; i++) {
            let toRemove = cache.inserts[i]
            let key = cache.keyByCollection(toRemove.collection)
            delete cache[toRemove.collection][toRemove.document[key]]
        }
        cache.inserts = []

        // reset leader changes
        for (let i in cache.leaderChanges)
            if (cache.leaderChanges[i][1] === 0)
                cache.addLeader(cache.leaderChanges[i][0],true,()=>{})
            else if (cache.leaderChanges[i][1] === 1)
                cache.removeLeader(cache.leaderChanges[i][0],true)
        cache.leaderChanges = []

        // and reset the econ data for nextBlock
        eco.nextBlock()
    },
    findOnePromise: function(collection, query, skipClone) {
        return new Promise((rs,rj) => cache.findOne(collection,query,(e,d) => e ? rj(e) : rs(d),skipClone))
    },
    findOne: function(collection, query, cb, skipClone) {
        if (!cache.copy[collection])
            return cb('invalid collection')

        let key = cache.keyByCollection(collection)
        // searching in cache
        if (cache[collection][query[key]]) {
            if (!skipClone)
                cb(null, cloneDeep(cache[collection][query[key]]))
            else
                cb(null, cache[collection][query[key]])
            return
        }
        
        // no match, searching in mongodb
        db.collection(collection).findOne(query, function(err, obj) {
            if (err) logr.debug('error cache')
            else {
                if (!obj) {
                    // doesnt exist
                    cb(); return
                }
                // found, adding to cache
                cache[collection][obj[key]] = obj

                // cloning the object before sending it
                if (!skipClone)
                    cb(null, cloneDeep(obj))
                else
                    cb(null, obj)
            }
        })
    },
    updateOnePromise: function (collection, query, changes) {
        return new Promise((rs,rj) => cache.updateOne(collection,query,changes,(e,d) => e ? rj(e) : rs(true)))
    },
    updateOne: function(collection, query, changes, cb) {
        cache.findOne(collection, query, function(err, obj) {
            if (err) throw err
            if (!obj) {
                cb(null, false); return
            }
            let key = cache.keyByCollection(collection)

            if (!cache.copy[collection][obj[key]] && (!chain.restoredBlocks || chain.getLatestBlock()._id >= chain.restoredBlocks))
                cache.copy[collection][obj[key]] = cloneDeep(cache[collection][obj[key]])
            
            for (let c in changes) 
                switch (c) {
                case '$inc':
                    for (let i in changes[c]) 
                        if (!cache[collection][obj[key]][i])
                            cache[collection][obj[key]][i] = changes[c][i]
                        else
                            cache[collection][obj[key]][i] += changes[c][i]
                    
                    break

                case '$push':
                    for (let p in changes[c]) {
                        if (!cache[collection][obj[key]][p])
                            cache[collection][obj[key]][p] = []
                        cache[collection][obj[key]][p].push(changes[c][p])
                    }
                    break

                case '$pull':
                    for (let l in changes[c]) 
                        for (let y = 0; y < cache[collection][obj[key]][l].length; y++)
                            if (typeof changes[c][l] === 'object') {
                                let matching = true
                                for (const v in changes[c][l])
                                    if (cache[collection][obj[key]][l][y][v] !== changes[c][l][v]) {
                                        matching = false
                                        break
                                    }
                                if (matching)
                                    cache[collection][obj[key]][l].splice(y, 1)
                            } else if (cache[collection][obj[key]][l][y] === changes[c][l]) 
                                cache[collection][obj[key]][l].splice(y, 1)
                            
                    break

                case '$set':
                    for (let s in changes[c]) 
                        cache[collection][obj[key]][s] = changes[c][s]
                    
                    break

                case '$unset':
                    for (let u in changes[c]) 
                        delete cache[collection][obj[key]][u]
                    
                    break
                
                default:
                    break
                }
            
            cache.changes.push({
                collection: collection,
                query: query,
                changes: changes
            })
            cb(null, true)
        }, true)
    },
    updateMany: function(collection, query, changes, cb) {
        let key = cache.keyByCollection(collection)
        if (!query[key] || !query[key]['$in']) 
            throw 'updateMany requires a $in operator'
        

        let indexesToUpdate = query[key]['$in']
        let executions = []
        for (let i = 0; i < indexesToUpdate.length; i++) 
            executions.push(function(callback) {
                let newQuery = {}
                newQuery[key] = indexesToUpdate[i]
                cache.updateOne(collection, newQuery, changes, function(err, result) {
                    callback(null, result)
                })
            })
        
        parallel(executions, function(err, results) {
            cb(err, results)
        })
    },
    insertOne: function(collection, document, cb) {
        let key = cache.keyByCollection(collection)
        if (cache[collection][document[key]]) {
            cb(null, false); return
        }
        cache[collection][document[key]] = document
        cache.inserts.push({
            collection: collection,
            document: document
        })

        cb(null, true)
    },
    addLeader: (leader,isRollback,cb) => {
        if (!cache.leaders[leader])
            cache.leaders[leader] = 1
        if (!isRollback)
            cache.leaderChanges.push([leader,1])
        // make sure account is cached
        cache.findOne('accounts',{name:leader},() => cb(),true)
    },
    removeLeader: (leader,isRollback) => {
        if (cache.leaders[leader])
            delete cache.leaders[leader]
        if (!isRollback)
            cache.leaderChanges.push([leader,0])
    },
    clear: function() {
        cache.changes = []
        cache.inserts = []
        cache.rebuild.changes = []
        cache.rebuild.inserts = []
        cache.leaderChanges = []
        for (let c in cache.copy)
            cache.copy[c] = {}
    },
    writeToDisk: function(rebuild, cb) {
        // if (cache.inserts.length) logr.debug(cache.inserts.length+' Inserts')
        let executions = []
        // executing the inserts (new comment / new account)
        let insertArr = rebuild ? cache.rebuild.inserts : cache.inserts
        for (let i = 0; i < insertArr.length; i++)
            executions.push(function(callback) {
                let insert = insertArr[i]
                db.collection(insert.collection).insertOne(insert.document, function(err) {
                    if (err) throw err
                    callback()
                })
            })

        // then the update with simple operation compression
        // 1 update per document concerned (even if no real change)
        let docsToUpdate = {}
        for (let c in cache.copy)
            docsToUpdate[c] = {}
        let changesArr = rebuild ? cache.rebuild.changes : cache.changes
        for (let i = 0; i < changesArr.length; i++) {
            let change = changesArr[i]
            let collection = change.collection
            let key = change.query[cache.keyByCollection(collection)]
            docsToUpdate[collection][key] = cache[collection][key]
        }

        // if (cache.changes.length) logr.debug(cache.changes.length+' Updates compressed to '+Object.keys(docsToUpdate.accounts).length+' accounts, '+Object.keys(docsToUpdate.contents).length+' contents')

        for (const col in docsToUpdate) 
            for (const i in docsToUpdate[col]) 
                executions.push(function(callback) {
                    let key = cache.keyByCollection(col)
                    let newDoc = docsToUpdate[col][i]
                    let query = {}
                    query[key] = newDoc[key]
                    db.collection(col).replaceOne(query, newDoc, function(err) {
                        if (err) throw err
                        callback()
                    })
                })

        // leader stats
        if (process.env.LEADER_STATS === '1') {
            let leaderStatsWriteOps = leaderStats.getWriteOps()
            for (let op in leaderStatsWriteOps)
                executions.push(leaderStatsWriteOps[op])
        }

        // tx history
        if (process.env.TX_HISTORY === '1') {
            let txHistoryWriteOps = txHistory.getWriteOps()
            for (let op in txHistoryWriteOps)
                executions.push(txHistoryWriteOps[op])
        }

        // current state at block number
        executions.push((callback) => db.collection('state').updateOne({_id: 0},{$set:{headBlock:chain.getLatestBlock()._id}},{ upsert: true },() => callback(null,true)))
        
        if (typeof cb === 'function') {
            let timeBefore = new Date().getTime()
            parallel(executions, function(err, results) {
                let execTime = new Date().getTime()-timeBefore
                if (!rebuild && execTime >= config.blockTime/2)
                    logr.warn('Slow write execution: ' + executions.length + ' mongo queries took ' + execTime + 'ms')
                else
                    logr.debug(executions.length+' mongo queries executed in '+execTime+'ms')
                cache.clear()
                cb(err, results)
            })
        } else {
            logr.debug(executions.length+' mongo ops queued')
            cache.writerQueue.push((callback) => parallel(executions,() => callback()))
            cache.clear()
        }
    },
    processRebuildOps: (cb,writeToDisk) => {
        for (let i in cache.inserts)
            cache.rebuild.inserts.push(cache.inserts[i])
        for (let i in cache.changes)
            cache.rebuild.changes.push(cache.changes[i])
        cache.inserts = []
        cache.changes = []
        cache.leaderChanges = []
        for (let c in cache.copy)
            cache.copy[c] = {}
        if (writeToDisk)
            cache.writeToDisk(true,cb)
        else
            cb()
    },
    keyByCollection: function(collection) {
        switch (collection) {
        case 'accounts':
            return 'name'
        default:
            return '_id'
        }
    },
    warmup: (collection, maxDoc) => new Promise((rs,rj) => {
        if (!collection || !maxDoc || maxDoc === 0)
            return rs(null)

        switch (collection) {
        case 'accounts':
            db.collection(collection).find({}, {
                sort: {node_appr: -1, name: -1},
                limit: maxDoc
            }).toArray(function(err, accounts) {
                if (err) throw err
                for (let i = 0; i < accounts.length; i++)
                    cache[collection][accounts[i].name] = accounts[i]
                rs(null)
            })
            break

        case 'contents':
            db.collection(collection).find({}, {
                sort: {ts: -1},
                limit: maxDoc
            }).toArray(function(err, contents) {
                if (err) throw err
                for (let i = 0; i < contents.length; i++)
                    cache[collection][contents[i]._id] = contents[i]
                rs(null)
            })
            break
    
        default:
            rj('Collection type not found')
            break
        }
    }),
    warmupLeaders: () => new Promise((rs) => {
        db.collection('accounts').find({
            $and: [
                {pub_leader: {$exists:true}},
                {pub_leader: {$ne: ''}}
            ]
        }).toArray((e,accs) => {
            if (e) throw e
            for (let i in accs) {
                cache.leaders[accs[i].name] = 1
                if (!cache.accounts[accs[i].name])
                    cache.accounts[accs[i].name] = accs[i]
            }
            rs(accs.length)
        })
    })
}

module.exports = cache
