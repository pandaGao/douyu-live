'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var net = _interopDefault(require('net'));
var EventEmitter = _interopDefault(require('events'));

const DANMAKU_SERVER = 'openbarrage.douyutv.com';
const DANMAKU_PORT = 8601;

const HEARTBEAT_INTERVAL = 45e3;
const DANMAKU_GROUP = -9999;

class STT {
  static parse (msg) {
    return msg.includes('@=')
      ? msg.split('/').reduce((obj, seg) => {
        let [key, val] = seg.split('@=');
        if (key) {
          obj[key] = this.decodeString(val);
        }
        return obj
      }, {})
      : msg.split('/').map(m => this.decodeString(m)).slice(0, -1)
  }

  static stringify (obj) {
    return obj instanceof Array
      ? obj.map(val => this.encodeString(val) + '/').join('')
      : Object.keys(obj)
        .map(key => `${this.encodeString(key)}@=${this.encodeString(obj[key])}/`)
        .join('')
  }

  static encodeString (str) {
    return (str + '').replace('/', '@S').replace('@', '@A')
  }

  static decodeString (str) {
    return (str + '').replace('@S', '/').replace('@A', '@')
  }
}

class DanmakuEncoder {
  static encode (data) {
    let message = STT.stringify(data) + '\0';
    let byteLength = Buffer.byteLength(message);
    let buff = Buffer.alloc(12 + byteLength);
    buff.writeInt32LE(byteLength + 8, 0);
    buff.writeInt32LE(byteLength + 8, 4);
    buff.writeInt16LE(689, 8);
    buff.write(message, 12);
    return buff
  }

  static login (roomId) {
    return this.encode({
      type: 'loginreq',
      roomid: roomId
    })
  }

  static logout () {
    return this.encode({
      type: 'logout'
    })
  }

  static joinGroup (roomId, groupId) {
    return this.encode({
      type: 'joingroup',
      rid: roomId,
      gid: groupId
    })
  }

  static keepLive () {
    return this.encode({
      type: 'mrkl'
    })
  }
}

class DanmakuDecoder extends EventEmitter {
  constructor () {
    super();
    this.buffer = Buffer.alloc(0);
  }

  static decodeSingleMessage (buffer) {
    return STT.parse(buffer.slice(12).toString().slice(0, -1))
  }

  append (buffer) {
    this.buffer = Buffer.concat([this.buffer, buffer]);
    for (let offset = 0, packageLength = 0; offset < buffer.length; offset += packageLength) {
      packageLength = buffer.readInt32LE(offset) + 4;
      let headerPackageLength = buffer.readInt32LE(offset + 4) + 4;
      if (packageLength !== headerPackageLength) {
        console.log('wrong!!!!!!!!!!!');
        this.buffer = Buffer.alloc(0);
        break
      }
      let packageBuffer = buffer.slice(offset, packageLength);
      if (packageBuffer.length < packageLength) {
        this.buffer = packageBuffer;
        break
      }
      this.emit('message', DanmakuDecoder.decodeSingleMessage(packageBuffer));
    }
  }
}

class DouyuRoom extends EventEmitter {
  constructor (config) {
    super();
    this.roomId = config.roomId;
    this._socket = null;
    this._decoder = new DanmakuDecoder();
    this._decoder.on('message', (message) => {
      this.messageHandler(message);
    });
    this._heartbeatService = null;
  }

  connect () {
    this._socket = net.connect(DANMAKU_PORT, DANMAKU_SERVER, () => {
      this._socket.write(DanmakuEncoder.login(this.roomId));
    });
    this._socket.on('data', (data) => {
      this._decoder.append(data);
    });
    this._socket.on('close', (data) => {
    });
    this._socket.on('error', (data) => {
    });
    return this
  }

  disconnect () {
    this._socket.write(DanmakuEncoder.logout());
    return this
  }

  heartbeatService () {
    this._socket.write(DanmakuEncoder.keepLive());
    this._heartbeatService = setTimeout(() => {
      this.heartbeatService();
    }, HEARTBEAT_INTERVAL);
  }

  messageHandler (message) {
    switch (message.type) {
      case 'loginres':
        this._socket.write(DanmakuEncoder.joinGroup(this.roomId, DANMAKU_GROUP));
        this.heartbeatService();
        this.emit('connected');
        break
      default:
        this.emit('message', message);
        break
    }
  }
}

module.exports = DouyuRoom;
