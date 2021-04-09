const axios = require('axios')

let config = {
    host: 'http://localhost',
    port: '3001',
    homeDir: "/home/ec2-user/",
    testnetDir: "/home/ec2-user/avalon_testnet/tavalon/avalon_testnet/",
    mainnetDir: "/home/ec2-user/tavalon/avalon/",
    scriptPath: "./scripts/start_mainnet.sh",
    logPath: "./avalon.log"
}

curbHeight = 0
prevbHeight = 0

function getCurTime() {
    var td = new Date()
    var d = String(td.getDate()).padStart(2, '0')
    var m = String(td.getMonth()).padStart(2, '0')

    var y = String(td.getFullYear())
    var h = String(td.getHours()).padStart(2, '0')
    var mn = String(td.getMinutes()).padStart(2, '0')
    var s = String(td.getSeconds()).padStart(2, '0')

    var dt = y + "/" + m + "/" + d + " " + h + ":" + mn + ":" + s
    console.log("\nCurrent Time = ", dt)
    console.log("------------------------------")
}

var exec = require('child_process').exec;

function runCmd(cmdStr) {
    exec(cmdStr,
        function (error, stdout, stderr) {
            if (error !== null) {
                console.log('exec error: ' + error);
                console.log('stdout: ' + stdout);
                console.log('stderr: ' + stderr);
            }
        }
    );
}

function getUrl() {
    var url = config.host + ":" + config.port
    return url
}

// sleep time expects milliseconds
function sleep (time) {
   return new Promise((resolve) => setTimeout(resolve, time));
}

function checkHeightAndRun() {
    var url = getUrl()
    axios.get(url + '/count').then((bHeight) => {
        curbHeight = bHeight.data.count

        getCurTime()

        console.log('Previous block height = ', prevbHeight)
        console.log('Current block height  = ', curbHeight)

        if(curbHeight == 0 || (prevbHeight != 0 && prevbHeight == curbHeight)) {
            var mineStartCmd = "curl " + getUrl() + "/" + "mineBlock"
            console.log("Restarting mining with mineBlock api.\n")
            //runCmd(mineStartCmd)
        }
        prevbHeight = curbHeight

        setTimeout(() => checkHeightAndRun(), 5000)

    }).catch(() => {
        console.log('failed to fetch block height to catchup to. Restarting avalon script.')
        runAvalonScriptCmd = config.scriptPath + " > " + config.logPath + " 2>&1 &"
        runCmd(runAvalonScriptCmd)

        sleep(5000).then(() =>
            checkHeightAndRun()
        )
    })
}

checkHeightAndRun()
