/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/7/5
 */
var _storeInstances = _storeInstances || {};
const lib = require('think_lib');
const adapters = {
    file: __dirname + '/adapter/file.js',
    redis: __dirname + '/adapter/redis.js',
    memcache: __dirname + '/adapter/memcache.js'
};


module.exports = class store {
    constructor(options = {}) {
        this.options = lib.extend({
            type: 'file', //数据缓存类型 file,redis,memcache
            key_prefix: 'Think:', //缓存key前置
            timeout: 6 * 3600, //数据缓存有效期，单位: 秒
            poolsize: 10,
            conn_timeout: 5000
        }, options);

        return store.getInstance(this.options);
    }

    /**
     *
     *
     * @static
     * @param {*} options
     * @returns
     */
    static getInstance(options) {
        if (options && (options.type in adapters)) {
            const adapter = lib.require(adapters[options.type]);
            const key = lib.md5(JSON.stringify(options));
            if (!_storeInstances[key] || !_storeInstances[key].client) {
                _storeInstances[key] = new adapter(options);
            }
            return _storeInstances[key];
        } else {
            throw Error('unsupport adapter!');
        }
    }
};