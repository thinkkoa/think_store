/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');
const memcachesocket = require('../socket/memcache.js');
var _cacheInstances = {};

module.exports = class {
    constructor(options = {}) {
        this.options = Object.assign({
            type: 'memcache', //数据缓存类型 file,redis,memcache
            key_prefix: 'Think:', //缓存key前置
            timeout: 6 * 3600, //数据缓存有效期，单位: 秒
            poolsize: 10,
            conn_timeout: 5000
        }, options);
        //兼容旧版
        this.options.host = this.options.host || this.options.memcache_host;
        this.options.port = this.options.port || this.options.memcache_port;
        this.options.db = this.options.db || this.options.redis_db;
        this.options.conn_timeout = this.options.conn_timeout || this.options.memcache_timeout;

        const key = `${this.options.host}_${this.options.port}}`;
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