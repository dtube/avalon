const https = require('https')
const http = require('http')

var apis = [
    'http://localhost:3001',
    'https://avalon.d.tube',
    'https://avalon.oneloved.tube',
    'https://avalon.tibfox.com',
]

var leaders = [
    'dtube', 'sagar.kothari.88', 'nannal', 'techcoderx', 'dabiggest01', 'fasolo97',
    'exnihilo.witness', 'teamhumble', 'thecoincritic.com', 'tibfox', 'brishtiteveja0595', 'd00k13', 'wiljman76', 'lintendlor'
]

var results = []
var finished = 0
for (let y = 0; y < leaders.length; y++) {
    results.push(Array(apis.length))
    for (let i = 0; i < apis.length; i++) {
        var protocol = http
        if (apis[i].indexOf('https://') === 0)
            protocol = https
        protocol.get(apis[i]+'/account/'+leaders[y], (resp) => {
            let data = ''
          
            // A chunk of data has been recieved.
            resp.on('data', (chunk) => {
                data += chunk
            })
          
            // The whole response has been received. Print out the result.
            resp.on('end', () => {
                finished++
                results[y][i] = JSON.parse(data).balance%100
                if (finished === apis.length * leaders.length) {
                    for (let r = 0; r < results.length; r++) {
                        console.log('\n\n'+leaders[r])
                        console.log(results[r])
                    }
                }
            });
          
          }).on("error", (err) => {
            console.log("Error: " + err.message);
        });
    }
}


