/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/7/5
 */
const lib = require('think_lib');
const adapters = {
    file: __dirname + '/adapter/file.js',
    redis: __dirname + '/adapter/redis.js',
    memcache: __dirname + '/adapter/memcache.js'
};

module.exports = class {
    constructor(options = {}) {
        this.options = lib.extend({
            type: 'file', //数据缓存类型 file,redis,memcache
            key_prefix: 'ThinkKoa:', //缓存key前置
            timeout: 6 * 3600 //数据缓存有效期，单位: 秒
        }, options);
    }

    static getInstance(options) {
        if (options && (options.type in adapters)) {
            const adapter = lib.require(adapters[options.type]);
            return new adapter(options);
        } else {
            return null;
        }
    }
};