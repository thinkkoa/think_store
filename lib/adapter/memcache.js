/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');
const memcached = require('memcached');

module.exports = class {
    constructor(options = {}) {
        //兼容旧版
        options.host = options.host || options.memcache_host;
        options.port = options.port || options.memcache_port;
        options.db = options.db || options.memcache_db;
        options.conn_timeout = options.conn_timeout || options.memcache_timeout;

        this.options = Object.assign({
            type: 'memcache', //数据缓存类型 file,redis,memcache
            key_prefix: 'Think:', //缓存key前置
            timeout: 6 * 3600, //数据缓存有效期，单位: 秒
            poolsize: 10,
            conn_timeout: 5000
        }, options);

        this.client = null;
    }

    /**
     *
     *
     * @returns
     */
    async connect(connnum = 0) {
        if (this.client && this.client.get) {
            return this.client;
        }
        const deferred = lib.getDefer();
        //[ '192.168.0.102:11211', '192.168.0.103:11211', '192.168.0.104:11211' ]
        const connection = new memcached([`${this.options.memcache_host}:${this.options.memcache_port}`], {
            poolSize: this.options.memcache_poolsize,
            timeout: this.options.memcache_timeout,
        });
        connection.on('reconnect', () => {
            this.client = connection;
            deferred.resolve(connection);
        });
        connection.on('failure', err => {
            this.close();
            if (connnum < 3) {
                connnum++;
                deferred.resolve(this.connect(connnum));
            } else {
                deferred.reject(err);
            }
        });
        setTimeout(() => {
            this.client = connection;
            deferred.resolve(connection);
        }, 300);
        return deferred.promise;
    }

    /**
     *
     *
     * @returns
     */
    close() {
        if (this.client) {
            this.client.end();
            this.client = null;
        }
        return;
    }

    /**
     *
     *
     * @param {*} name
     * @param {*} data
     * @returns
     */
    async wrap(name, data) {
        try {
            const conn = await this.connect();
            const res = await conn[name](...data);
            return res;
        } catch (error) {
            this.close();
            return Promise.reject(error);
        }
    }

    /**
     *
     *
     * @param {*} name
     * @param {*} data
     * @param {*} validate
     * @param {*} type
     * @returns
     */
    async command(name, data, validate, type) {
        const conn = await this.connect();
        conn.command({
            key: name,
            validate: validate,
            type: type,
            command: data
        });
        return conn;
    }

    /**
     *
     * @param name
     */
    get(name) {
        return this.wrap('get', [this.options.key_prefix + name]);
    }

    /**
     *
     * @param name
     * @param value
     * @param timeout
     */
    set(name, value, timeout = this.options.timeout) {
        return this.wrap('set', [this.options.key_prefix + name, JSON.stringify(value), timeout]);
    }

    /**
     *
     * @param name
     */
    rm(name) {
        return this.wrap('del', [this.options.key_prefix + name]);
    }

    /**
     * 设置key超时属性
     * @param name
     * @param timeout
     */
    expire(name, timeout = this.options.timeout) {
        return this.wrap('touch', [this.options.key_prefix + name, timeout]);
    }

    /**
     * 自增
     * @param name
     */
    incr(name) {
        return this.wrap('incr', [this.options.key_prefix + name, 1]);
    }

    /**
     * 自减
     * @param name
     * @returns {*}
     */
    decr(name) {
        return this.wrap('decr', [this.options.key_prefix + name, 1]);
    }
};