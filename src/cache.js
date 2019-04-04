const series = require('run-series')

var cache = {
    accounts: {},
    contents: {},
    changes: [],
    findOne: function(collection, query, cb) {
        if (['accounts','blocks','contents'].indexOf(collection) === -1) {
            cb(true)
            return
        }
        var key = cache.keyByCollection(collection)
        // searching in cache
        if (cache[collection][query[key]]) {
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
                cb(null, obj)
            }
        })
    },
    updateOne: function(collection, query, changes, cb) {
        cache.findOne(collection, query, function(err, obj) {
            if (err) throw err
            if (!obj) {
                cb(null, false); return
            }
            var key = cache.keyByCollection(collection)
            for (var c in changes) 
                switch (c) {
                case '$inc':
                    for (var i in changes[c]) 
                        if (!cache[collection][obj[key]][i])
                            cache[collection][obj[key]][i] = changes[c][i]
                        else
                            cache[collection][obj[key]][i] += changes[c][i]
                    
                    break

                case '$push':
                    for (var p in changes[c]) 
                        cache[collection][obj[key]][p].push(changes[c][p])
                    
                    break

                case '$pull':
                    for (var l in changes[c]) 
                        for (let y = 0; y < cache[collection][obj[key]][l].length; y++) 
                            if (cache[collection][obj[key]][l][y] === changes[c][l]) 
                                cache[collection][obj[key]][l].splice(y, 1)
                            
                        
                    
                    break

                case '$set':
                    for (var s in changes[c]) 
                        cache[collection][obj[key]][s] = changes[c][s]
                    
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
        })
    },
    updateMany: function(collection, query, changes, cb) {
        var key = cache.keyByCollection(collection)
        if (!query[key] || !query[key]['$in']) 
            throw 'updateMany requires a $in operator'
        

        var indexesToUpdate = query[key]['$in']
        var executions = []
        for (let i = 0; i < indexesToUpdate.length; i++) 
            executions.push(function(callback) {
                var newQuery = {}
                newQuery[key] = indexesToUpdate[i]
                cache.updateOne(collection, newQuery, changes, function(err, result) {
                    callback(null, result)
                })
            })
        
        series(executions, function(err, results) {
            cb(err, results)
        })
    },
    clear: function() {
        cache.accounts = {}
        cache.contents = {}
    },
    writeToDisk: function(cb) {
        var executions = []
        // simple operation compression
        // 1 update per document concerned (even if no real change)
        var docsToUpdate = {
            accounts: {},
            contents: {}
        }
        for (let i = 0; i < cache.changes.length; i++) {
            var change = cache.changes[i]
            var collection = change.collection
            var key = change.query[cache.keyByCollection(collection)]
            docsToUpdate[collection][key] = cache[collection][key]
        }
        for (const col in docsToUpdate) 
            for (const i in docsToUpdate[col]) 
                executions.push(function(callback) {
                    var key = cache.keyByCollection(col)
                    var newDoc = docsToUpdate[col][i]
                    var query = {}
                    query[key] = newDoc[key]
                    db.collection(col).updateOne(query, {$set: newDoc}, function(err) {
                        if (err) throw err
                        callback()
                    })
                })
            
        

        // no operation compression (dumb and slow)
        // for (let i = 0; i < cache.changes.length; i++) {
        //     executions.push(function(callback) {
        //         var change = cache.changes[i]
        //         db.collection(change.collection).updateOne(change.query, change.changes, function() {
        //             callback()
        //         })
        //     })
        // }

        //var timeBefore = new Date().getTime()
        series(executions, function(err, results) {
            //logr.debug(executions.length+' mongo update executed in '+(new Date().getTime()-timeBefore)+'ms')
            cb(err, results)
            cache.changes = []
        })
    },
    keyByCollection: function(collection) {
        switch (collection) {
        case 'accounts':
            return 'name'
        
        default:
            return '_id'
        }
    }
}

module.exports = cache