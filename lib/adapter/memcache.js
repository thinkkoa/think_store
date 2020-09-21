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
        this.client = null;
    }
    /**
     * connect to server
     *
     * @param {*} options
     * @param {number} [connnum=0]
     * @returns
     */
    connect(options, connnum = 0) {
        if (this.client && this.client.get) {
            return this.client;
        }
        const deferred = lib.getDefer();
        //[ '192.168.0.102:11211', '192.168.0.103:11211', '192.168.0.104:11211' ]
        const connection = new memcached([`${options.memcache_host}:${options.memcache_port}`], {
            poolSize: options.memcache_poolsize,
            timeout: options.memcache_timeout,
        });
        connection.on('reconnect', () => {
            this.client = connection;
            deferred.resolve(connection);
        });
        connection.on('failure', err => {
            if (connnum < 3) {
                connnum++;
                deferred.resolve(this.connect(options, connnum));
            } else {
                deferred.reject(err);
            }
        });
        setTimeout(() => {
            this.client = connection;
            deferred.resolve(connection);
        }, 100);
        return deferred.promise;
    }

    /**
     * get connection from pool
     *
     * @returns
     */
    async getConnection() {
        if (!this.pool || !this.pool.acquire) {
            const factory = {
                create: () => {
                    return this.connect(this.options);
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
        client = client || this.client;
        if (client) {
            client.end();
        }
        if (this.pool) {
            this.pool.destroy();
        }
        this.client = null;
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
            conn = await this.getConnection();
            const res = await conn[name](...data);
            if (this.pool.isBorrowedResource(conn)) {
                this.pool.release(conn);
            }
            return res;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     *
     *
     * @param {*} name
     * @param {*} data {validate: ..., type: ..., command: ...}
     * @returns
     */
    async command(name, data) {
        const conn = await this.connect(this.options);
        conn.command({
            key: name,
            validate: data.validate,
            type: data.type,
            command: data.command
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