module.exports = {
    fields: ['link','seq'],
    validate: (tx, ts, legitUser, cb) => {
        if (!config.playlistEnabled)
            return cb(false, 'playlists are disabled')

        // validate link
        if (!validate.string(tx.data.link,config.playlistLinkMax,config.playlistLinkMin))
            return cb(false, 'invalid playlist link')

        // validate playlist json
        if (!validate.array(tx.data.seq))
            return cb(false, 'invalid array of sequences to be removed')

        // validate playlist sequence number to be deleted
        for (let s in tx.data.seq)
            if (!validate.integer(tx.data.seq[s],true,false,config.playlistSequenceIdMax))
                return cb(false,'invalid playlist sequence '+s)

        cb(true)
    },
    execute: (tx, ts, cb) => {
        cache.findOne('playlists',{_id: tx.sender+'/'+tx.data.link},(e,p) => {
            let newPlaylist = p.playlist
            for (let s in tx.data.seq)
                delete newPlaylist[tx.data.seq[s]]
            cache.updateOne('playlists',{_id: tx.sender+'/'+tx.data.link}, {
                $set: { playlist: newPlaylist }
            },() => cb(true))
        })
    }
}