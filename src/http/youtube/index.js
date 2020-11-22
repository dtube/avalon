const YT = require('simple-youtube-api')
const yt_key = process.env.YT_API_KEY || 'NO_KEY'
const yt = new YT(yt_key)

module.exports = {
    init: (app) => {
        // 3rd party video embed data
        // get youtube info
        app.get('/youtube/:videoId', (req, res) => {
            if (!req.params.videoId) {
                res.sendStatus(500)
                return
            }
            yt.getVideoByID(req.params.videoId).then(function (video) {
                video.duration = video.durationSeconds
                res.send(video)
            }).catch(function (err) {
                logr.warn('YouTube API error', err)
                res.sendStatus(500)
            })
        })
    }
}
