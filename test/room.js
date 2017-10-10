const DouyuRoom = require('../dist/douyu-live.js')

let room = new DouyuRoom({
  roomId: 1504507
}).connect()

room.on('message', msg => {
  console.log(msg)
})
