const store = require('./lib/store');
const helper = require('think_lib');

const config = {
    type: 'redis', //
    key_prefix: '', //缓存key前置
    timeout: null, //数据缓存有效期，单位: 秒
    host: '192.168.0.150',
    port: 6379,
    auth_pass: '',
    db: '0',
    conn_timeout: 5000,
};

const client = new store(config);
// const client = store.getInstance(config);
echo(client);
return client.get('20190702').then(res => {
    echo(res);
}).catch(err => {
    echo(err.stack);
});
