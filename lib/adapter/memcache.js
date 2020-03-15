/**
 *
 * @author     richen
 * @copyright  Copyright (c) 2017 - <richenlin(at)gmail.com>
 * @license    MIT
 * @version    17/6/6
 */
const lib = require('think_lib');
const logger = require('think_logger');
const genericPool = require('generic-pool');
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

        this.pool = null;
    }

    /**
     *
     *
     * @returns
     */
    async connect() {
        if (!this.pool || !this.pool.acquire) {
            const factory = {
                create: () => {
                    const conn = new memcached([`${this.options.host}:${this.options.port}`], {
                        timeout: this.options.conn_timeout,
                        retries: 5,
                    });
                    conn.on('failure', (err) => {
                        logger.error(err);
                    });
                    return conn;
                },
                destroy: (client) => {
                    return this.close(client);
                },
                // validate: (resource) => {
                //     return resource.status === 'ready';
                // }
            };
            this.pool = genericPool.createPool(factory, {
                max: this.options.poolsize || 10, // maximum size of the pool
                min: 2 // minimum size of the pool
            });
            this.pool.on('factoryCreateError', function (err) {
                logger.error(err);
            });
            this.pool.on('factoryDestroyError', function (err) {
                logger.error(err);
            });
        }

        return this.pool.acquire();
    }

    /**
     *
     *
     * @param {*} client
     * @returns
     */
    close(client) {
        if (client) {
            client.end();
        }
        this.pool = null;
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
        let conn;
        try {
            conn = await this.connect();
            const res = await conn[name](...data);
            this.pool.release(conn);
            return res;
        } catch (error) {
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