const sharp = require('sharp')
const fetch = require('node-fetch-commonjs')
const QUALITY = 95
const AVATAR_WIDTH = {
    small: 64,
    medium: 128, // default
    large: 512
}
const DEFAULT_AVATAR = 'https://steemitimages.com/DQmb2HNSGKN3pakguJ4ChCRjgkVuDN9WniFRPmrxoJ4sjR4'
const CACHE_SIZE = parseInt(process.env.IMG_CACHE_SIZE) || -1
const CACHE_TIME = parseInt(process.env.IMG_CACHE_TIME) || 900000 // 15 minutes default

let imageCache = {
    avatar: {
        small: {},
        medium: {},
        large: {}
    },
    cover: {}
}

module.exports = {
    init: (app) => {
        /**
         * @api {get} /image/avatar/:name/:size Avatar
         * @apiName avatar
         * @apiGroup Image
         * 
         * @apiParam {String} name Username to retrieve avatar of
         * @apiParam {String} size Size of avatar. Valid values: `small`, `medium` and `large`.
         * 
         * @apiSuccess {Binary} image The image file of the avatar
         * @apiSampleRequest off
         */
        app.get('/image/avatar/:name/:size?', (req, res) => {
            if (!req.params.name)
                return res.status(400).send({error: 'username is required'})
            let size = req.params.size || 'medium'
            if (!imageCache.avatar[size] || size.startsWith('default_'))
                size = 'medium'

            // Return cached image if available
            if (imageCache.avatar[size][req.params.name] && imageCache.avatar[size][req.params.name].t) {
                imageCache.avatar[size][req.params.name].t = new Date().getTime()
                if (!imageCache.avatar[size][req.params.name].d && imageCache.avatar['default_'+size])
                    return imageResponse(res,Buffer.from(imageCache.avatar['default_'+size]))
                else if (imageCache.avatar[size][req.params.name].d)
                    return imageResponse(res,Buffer.from(imageCache.avatar[size][req.params.name].d))
            }

            // If not look for image url and fetch
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (err) return res.status(400).send({error: 'could not retrieve account info'})
                if (!account) return res.status(404).send({error: 'username does not exist'})
                // todo return default avatar if no avatar url in metadata
                let isDefault = false
                let imageUrl = ''
                if (!account.json || !account.json.profile || !account.json.profile.avatar) {
                    isDefault = true
                    imageUrl = DEFAULT_AVATAR
                } else {
                    imageUrl = account.json.profile.avatar
                    if (!imageUrl.startsWith('http')) {
                        isDefault = true
                        imageUrl = DEFAULT_AVATAR
                    }
                }

                fetchAndRespondImage(imageUrl,res,AVATAR_WIDTH[size],AVATAR_WIDTH[size],(imgJson) => {
                    if (isDefault) {
                        imageCache.avatar[size][req.params.name] = { t: new Date().getTime() }
                        imageCache.avatar['default_'+size] = imgJson
                    } else if (JSON.stringify(imageCache).length < CACHE_SIZE) imageCache.avatar[size][req.params.name] = {
                        t: new Date().getTime(),
                        d: imgJson
                    }
                })
            })
        })

        /**
         * @api {get} /image/cover/:name Cover
         * @apiName cover
         * @apiGroup Image
         * 
         * @apiParam {String} name Username to retrieve channel cover of
         * 
         * @apiSuccess {Binary} image The image file of the cover
         * @apiSampleRequest off
         */
        app.get('/image/cover/:name',(req,res) => {
            if (!req.params.name)
                return res.status(400).send({error: 'username is required'})
            if (imageCache.cover[req.params.name] && imageCache.cover[req.params.name].d) {
                imageCache.cover[req.params.name].t = new Date().getTime()
                return imageResponse(res,Buffer.from(imageCache.cover[req.params.name].d))
            }
            db.collection('accounts').findOne({ name: req.params.name }, function (err, account) {
                if (err) return res.status(400).send({error: 'could not retrieve account info'})
                if (!account) return res.status(404).send({error: 'username does not exist'})
                if (!account.json || !account.json.profile || !account.json.profile.cover_image)
                    return res.status(404).send({error: 'cover image url not available'})
                const imageUrl = account.json.profile.cover_image
                if (!imageUrl.startsWith('http'))
                    return res.status(404).send({error: 'invalid cover image url'})

                fetchAndRespondImage(imageUrl,res,2048,512,(imgJson) => {
                    if (JSON.stringify(imageCache).length < CACHE_SIZE) imageCache.cover[req.params.name] = {
                        t: new Date().getTime(),
                        d: imgJson
                    }
                })
            })
        })

        app.get('/image/cachesize',(req,res) => {
            res.send({size: JSON.stringify(imageCache).length})
        })

        // cleanup cache
        setInterval(() => {
            let timeNow = new Date().getTime()
            for (let s in imageCache.avatar) if (!s.startsWith('default_')) for (let u in imageCache.avatar[s])
                if (timeNow - imageCache.avatar[s][u].t > CACHE_TIME)
                    delete imageCache.avatar[s][u]
            for (let u in imageCache.cover)
                if (timeNow - imageCache.cover[u].t > CACHE_TIME)
                    delete imageCache.cover[u]
        },30000)
    }
}

async function fetchAndRespondImage(imageUrl,res,width,height,cacher) {
    try {
        let imgFetch = await fetch(imageUrl)
        let buffer = await imgFetch.buffer()
        let img = await resizeImage(buffer,width,height)
        imageResponse(res,img)
        cacher(img.toJSON())
    } catch (e) {
        res.status(500).send({error: 'errored while retrieving avatar'})
    }
}

function resizeImage(buf,width,height) {
    return new Promise((rs,rj) => {
        sharp(buf)
            .resize(width,height)
            .toFormat('png',{quality: QUALITY})
            .toBuffer((err, data) => {
                if (err) return rj(err)
                rs(data)
            })
    })
}

function imageResponse(res,img) {
    res.setHeader('Cache-Control', 'public, max-age=3600000')
    res.setHeader('Content-Type', 'image/png')
    res.send(img)
}