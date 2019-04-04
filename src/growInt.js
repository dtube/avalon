// this class simplifies managing variables that are moving over time (eg bandwidth, vote tokens)
// raw should be of the format {v:<int>,t:<timestamp>}
// config must have: growth
// config can also have: min, max.
// maybe use BigInt one day here

module.exports = class GrowInt {
    constructor(raw, config) {
        if (!config.min)
            config.min = Number.MIN_SAFE_INTEGER
        if (!config.max)
            config.max = Number.MAX_SAFE_INTEGER
        this.v = raw.v
        this.t = raw.t
        this.config = config
    }

    grow(time) {
        if (time < this.t) return
        if (this.config.growth == 0) return {
            v: this.v,
            t: time
        }

        var tmpValue = this.v
        tmpValue += (time-this.t)*this.config.growth
        
        var newValue = 0
        var newTime = 0
        if (this.config.growth > 0) {
            newValue = Math.floor(tmpValue)
            newTime = Math.ceil(this.t + ((newValue-this.v)/this.config.growth))
        } else {
            newValue = Math.ceil(tmpValue)
            newTime = Math.floor(this.t + ((newValue-this.v)/this.config.growth))
        }

        if (newValue > this.config.max)
            newValue = this.config.max

        if (newValue < this.config.min)
            newValue = this.config.min

        return {
            v: newValue,
            t: newTime
        }
    }
}

