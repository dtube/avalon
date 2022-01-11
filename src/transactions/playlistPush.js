module.exports = {
    fields: ['link','seq'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.playlistEnabled)
            return cb(false, 'playlists are disabled')

        // validate link
        if (!validate.string(tx.data.link,config.playlistLinkMax,config.playlistLinkMin))
            return cb(false, 'invalid playlist link')

        // validate playlist json
        if (!validate.json(tx.data.seq,config.jsonMaxBytes))
            return cb(false, 'invalid playlist seq json')

        cache.findOne('playlists',{_id: tx.sender+'/'+tx.data.link},(e,p) => {
            if (!p)
                return cb(false, 'playlist does not exist')
            let newContents = 0
            for (let s in tx.data.seq) {
                // validate playlist sequence id
                if (s !== parseInt(s).toString() || !validate.integer(parseInt(s),true,false,config.playlistSequenceIdMax))
                    return cb(false,'invalid playlist sequence '+s)
                
                // validate content link for every sequence id
                if (!validate.string(tx.data.seq[s],config.playlistContentLinkMax,config.playlistContentLinkMin))
                    return cb(false,'invalid playlist content link for sequence #'+s)

                // increment new sequences
                if (!p.playlist[s])
                    newContents++
            }
            if (Object.keys(p.playlist).length + newContents > config.playlistSequenceMax)
                return cb(false,'playlist sequence max limit exceeded')

            return cb(true)
        })
    },
    execute: (tx, ts, cb) => {
        cache.findOne('playlists',{_id: tx.sender+'/'+tx.data.link},(e,p) => {
            cache.updateOne('playlists',{_id: tx.sender+'/'+tx.data.link}, {
                $set: { playlist: Object.assign(p.playlist,tx.data.seq) }
            },() => cb(true))
        })
    }
}