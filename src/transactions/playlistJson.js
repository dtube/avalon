const validate = require('../validate')
module.exports = {
    bsonValidate: true,
    fields: ['link','json'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.playlistEnabled)
            return cb(false, 'playlists are disabled')

        // validate link
        if (!validate.string(tx.data.link,config.playlistLinkMax,config.playlistLinkMin))
            return cb(false, 'invalid playlist link')

        // validate playlist json
        if (!validate.json(tx.data.json,config.jsonMaxBytes))
            return cb(false, 'invalid playlist json metadata')
        
        cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.findOne('playlists',{_id: tx.sender+'/'+tx.data.link},(e,p) => {
            if (!p)
                // playlist does not exist, create a new one
                cache.insertOne('playlists', {
                    _id: tx.sender+'/'+tx.data.link,
                    ts: ts,
                    json: process.env.PLAYLIST_JSON === '1' ? tx.data.json : {},
                    playlist: {}
                }, () => cb(true))
            else if (process.env.PLAYLIST_JSON === '1')
                // playlist exists, update json only if PLAYLIST_JSON module is enabled
                cache.updateOne('playlists', {_id: tx.sender+'/'+tx.data.link}, {$set: {json: tx.data.json}}, () => cb(true))
            else
                cb(true)
        })
    }
}