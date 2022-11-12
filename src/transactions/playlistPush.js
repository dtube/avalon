module.exports = {
    bsonValidate: true,
    fields: ['link','seq'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.playlistEnabled)
            return cb(false, 'playlists are disabled')

        // validate link
        if (!validate.string(tx.data.link,config.playlistLinkMax,config.playlistLinkMin))
            return cb(false, 'invalid playlist link')

        // validate playlist json
        if (!validate.array(tx.data.seq))
            return cb(false, 'invalid playlist seq array')

        cache.findOne('playlists',{_id: tx.sender+'/'+tx.data.link},(e,p) => {
            if (!p)
                return cb(false, 'playlist does not exist')
            let newContents = 0
            for (let s in tx.data.seq) {
                if (!validate.array(tx.data.seq[s],2))
                    return cb(false, 'invalid playlist seq index #'+s+' array')

                // validate playlist sequence id
                if (!validate.integer(tx.data.seq[s][0],true,false,config.playlistSequenceIdMax))
                    return cb(false,'invalid playlist sequence '+tx.data.seq[s][0]+' at index #'+s)
                
                // validate content link for every sequence id
                if (!validate.string(tx.data.seq[s][1],config.playlistContentLinkMax,config.playlistContentLinkMin))
                    return cb(false,'invalid playlist content link for sequence '+tx.data.seq[s][0]+' at index #'+s)

                // increment new sequences
                if (!p.playlist[tx.data.seq[s][0]])
                    newContents++
            }
            if (Object.keys(p.playlist).length + newContents > config.playlistSequenceMax)
                return cb(false,'playlist sequence max limit exceeded')

            return cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        cache.findOne('playlists',{_id: tx.sender+'/'+tx.data.link},(e,p) => {
            for (let s in tx.data.seq)
                p.playlist[tx.data.seq[s][0]] = tx.data.seq[s][1]
            cache.updateOne('playlists',{_id: tx.sender+'/'+tx.data.link}, {
                $set: { playlist: p.playlist }
            },() => cb(true))
        })
    }
}