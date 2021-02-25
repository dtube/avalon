const request = [
    require('http'),
    require('https')
]
const sharp = require('sharp')
const QUALITY = 90
const AVATAR_WIDTH = {
    small: 64,
    medium: 128,
    large: 512
}

module.exports = {
    init: (app) => {
        // get avatar for an account
        app.get('/image/avatar/:name/', (req,res) => {
            res.redirect('/image/avatar/'+req.params.name+'/small')
        })
        app.get('/image/avatar/:name/:size', (req, res) => {
            if (!req.params.name) {
                res.sendStatus(500)
                return
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (!account) res.sendStatus(404)
                if (!account.json || !account.json.profile || !account.json.profile.avatar)
                    return res.sendStatus(404)
                const imageUrl = account.json.profile.avatar
                if (!imageUrl.startsWith('http'))
                    return res.sendStatus(404)

                console.log(imageUrl)

                try {
                    let pIndex = 0
                    if (imageUrl.startsWith('https://'))
                        pIndex = 1

                    request[pIndex].get(imageUrl, function(resImg) {
                        var data = []
                        resImg.on('data', function(chunk) {
                            data.push(chunk)
                        }).on('end', function() {
                            var buffer = Buffer.concat(data)
                            let size = AVATAR_WIDTH[req.params.size] || AVATAR_WIDTH.small
                            let img = sharp(buffer)
                                .resize(size, size)
                                .toFormat('jpg',{quality: QUALITY})
                                .toBuffer((err, data) => {
                                    console.log(err)
                                    console.log(data)
                                    res.setHeader('Cache-Control', 'public, max-age=3600000')
                                    res.setHeader('Content-Type', 'image/png')
                                    res.send(data)
                                })
                        })
                    })
                } catch (error) {
                    console.log('catch error', error)
                }
            })
        })
    }
}
