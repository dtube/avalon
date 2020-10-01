const spawn = require('child_process').spawn

var nodeVersion = 10
var outPath = 'bin'

var platform = process.platform
if (platform === 'win32')
    platform = 'win'
if (platform === 'darwin')
    platform = 'macos'

var arch = process.arch
if (arch === 'x32')
    arch = 'x86'

var target = 'node'+nodeVersion+'-'+platform+'-'+arch
console.log('Compiling avalon for '+target)
var cmd = 'src/cli.js --output '+outPath+'/avalon --targets '+target

const compile_cli = spawn('pkg', cmd.split(' '))
compile_cli.stdout.on('data', function (data) {
    console.log(data.toString())
})

compile_cli.stderr.on('data', function (data) {
    console.log(data.toString())
})

compile_cli.on('exit', function (code) {
    console.log('Finished compiling avalon')
    console.log('Compiling avalond for '+target)

    cmd = 'src/main.js --options stack-size=65500 --output '+outPath+'/avalond --targets '+target
    const compile_daemon = spawn('pkg', cmd.split(' '))
    compile_daemon.stdout.on('data', function (data) {
        console.log(data.toString())
    })
    
    compile_daemon.stderr.on('data', function (data) {
        console.log(data.toString())
    })
    
    compile_daemon.on('exit', function (code) {
        console.log('Finished compiling avalond')
    })
})

