module.exports = {
    init: (app) => {
        /**
         * @api {get} /playlist/:author/:link Playlist Info
         * @apiName playlist
         * @apiGroup Playlists
         * 
         * @apiParam {String} author Author of the playlist
         * @apiParam {String} link Permlink of the playlist
         * 
         * @apiSuccess {String} _id Playlist identifier
         * @apiSuccess {Integer} ts Playlist creation timestamp
         * @apiSuccess {Object} json Playlist JSON metadata
         * @apiSuccess {Object} playlist Playlist sequence
         */
        app.get('/playlist/:author/:link', (req,res) => {
            if (!req.params.author || !req.params.link)
                return res.status(400).send({error: 'author and link is required'})
            db.collection('playlists').findOne({_id: req.params.author+'/'+req.params.link}, (e,p) => {
                if (!p)
                    return res.status(404).send({error: 'playlist does not exist'})
                else
                    return res.send(p)
            })
        })
    }
}