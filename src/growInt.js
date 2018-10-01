// this class simplifies managing variables that are moving over time.
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
        
        if (this.config.max && tmpValue > this.config.max)
            tmpValue = this.config.max

        if (this.config.min && tmpValue < this.config.min)
            tmpValue = this.config.min

        if (this.config.growth > 0) {
            var newValue = Math.floor(tmpValue)
            var newTime = Math.ceil(this.t + ((newValue-this.v)/this.config.growth))
        } else {
            var newValue = Math.ceil(tmpValue)
            var newTime = Math.floor(this.t + ((newValue-this.v)/this.config.growth))
        }

        return {
            v: newValue,
            t: newTime
        }
    }
}

