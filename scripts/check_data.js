const https = require('https')
const http = require('http')

var apis = [
    'http://localhost:3001',
    'http://ec2-18-191-134-93.us-east-2.compute.amazonaws.com:3001',
    'http://157.230.108.138:3001',
    'https://avalon.d.tube',
    'https://avalon.oneloved.tube',
]

var leaders = [
    'hightouch', 'tibfox', 'tokyo', 'brishtiteveja0595', 'exnihilo.witness',
    'teamhumble', 'dtube', 'zurich', 'techcoderx', 'los-angeles'
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


