let data = {};

module.exports = {
    get: function(name, def) {
        if (data[name])
            return data[name];

        return def ? def : null;
    },

    set: function(name, value) {
        data[name] = value;
    }
};