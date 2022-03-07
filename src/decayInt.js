// this class simplifies managing variables that are depleting over time (eg payment reservoir)
// raw should be of the format {v:<int>,t:<timestamp>}
// config must have: halflife
// config can also have: max.

module.exports = class DecayInt {
    constructor(raw, config) {
        if (!config.max)
            config.max = Number.MAX_SAFE_INTEGER
        config.lifetime = Math.log(2)/config.halflife
        this.v = raw.v
        this.t = raw.t
        this.config = config
    }

    decay(time) {
        if (time < this.t) return
        if (this.v === 0) return {v:0,t:time}

        let tmpValue = this.v
        let timeDiff = time-this.t
        tmpValue = tmpValue*Math.exp(-this.config.lifetime*timeDiff)
        
        let newValue = Math.ceil(tmpValue)
        let newTime = Math.ceil(this.t-Math.log(newValue/this.v)/this.config.lifetime)

        if (newValue > this.config.max)
            newValue = this.config.max

        return {
            v: newValue,
            t: newTime
        }
    }
}

