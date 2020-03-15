const store = require('../lib/store');
const helper = require('think_lib');

const config = {
    type: 'redis', //
    // type: 'memcache', //
    key_prefix: '', //缓存key前置
    timeout: null, //数据缓存有效期，单位: 秒
    host: '192.168.0.150',
    port: 6379,
    // port: 11211,
    auth_pass: '',
    db: '0',
    conn_timeout: 5000,
};

const client = new store(config);
// const client = store.getInstance(config);
// echo(client);
// return client.get('20190702').then(res => {
//     echo(res);
//     process.exit();
// }).catch(err => {
//     echo(err.stack);
//     process.exit();
// });
const batchFunc = async function () {
    // const client2 = await client.command('tget', {
    //     numberOfKeys: 1,
    //     lua: `return redis.call("get",KEYS[1])`
    // });
    for (let i = 0; i < 20; i++) {
        await client.get('20190702').then(res => {
            echo(res);
        });
    }
};

setInterval(batchFunc, 10000);
