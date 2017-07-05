/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');
const store = require('../store.js');
const memcachesocket = require('../socket/memcache.js');
var _cacheInstances = {};

module.exports = class extends store {
    constructor(options = {}) {
        super(options);
        let key = lib.md5(`${this.options.memcache_host}_${this.options.memcache_port}`);
        if (!(key in _cacheInstances)) {
            _cacheInstances[key] = new memcachesocket(this.options);
        }
        this.handle = _cacheInstances[key];
    }

    /**
     *
     * @param name
     */
    get(name) {
        return this.handle.wrap('get', [this.options.key_prefix + name]);
    }

    /**
     *
     * @param name
     * @param value
     * @param timeout
     */
    set(name, value, timeout = this.options.timeout) {
        return this.handle.wrap('set', [this.options.key_prefix + name, JSON.stringify(value), timeout]);
    }

    /**
     *
     * @param name
     */
    rm(name) {
        return this.handle.wrap('del', [this.options.key_prefix + name]);
    }

    /**
     * 设置key超时属性
     * @param name
     * @param timeout
     */
    expire(name, timeout = this.options.timeout) {
        return this.handle.wrap('touch', [this.options.key_prefix + name, timeout]);
    }

    /**
     * 自增
     * @param name
     */
    incr(name) {
        return this.handle.wrap('incr', [this.options.key_prefix + name, 1]);
    }

    /**
     * 自减
     * @param name
     * @returns {*}
     */
    decr(name) {
        return this.handle.wrap('decr', [this.options.key_prefix + name, 1]);
    }
};