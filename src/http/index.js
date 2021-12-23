const http_port = process.env.HTTP_PORT || 3001
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const fs = require('fs')

let http = {
    init: () => {
        let app = express()
        app.use(cors())
        app.use(bodyParser.json())

        // any folder in the /http/ folder is a different api endpoint
        let endpoints = fs.readdirSync(__dirname, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
        for (let i = 0; i < endpoints.length; i++)
            try {
                require(__dirname+'/'+endpoints[i]).init(app)
                logr.debug('Initialized API endpoint /'+endpoints[i])
            } catch (error) {
                logr.error('Failed to load API endpoint /'+endpoints[i])
            }
            
        app.listen(http_port, () => logr.info('Listening http on port: ' + http_port))
    }
}

module.exports = http
