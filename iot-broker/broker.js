'use strict'

const Seneca = require('seneca')
const VidiMetrics = require('vidi-metrics')
const SenecaMetrics = require('vidi-seneca-metrics')
const Mosca = require('mosca')
const MoscaAuth = require('seneca-mosca-auth')
const dgram = require('dgram')
const socket = dgram.createSocket('udp4')

const seneca = Seneca()

const server = new Mosca.Server({
  logger: {
    level: 'info'
  }
})

seneca.use(VidiMetrics, {emitter: {enabled: true}})
seneca.use(SenecaMetrics, {tag: server.id, group: 'broker', pins: ['role:mosca-auth, cmd:register']})

// set up seneca-mosca-auth
seneca.use(MoscaAuth)
MoscaAuth.setup(seneca, server)

seneca.act({
  role: 'mosca-auth',
  cmd: 'register',
  nick: 'fakedevice',
  email: 'matteo.collina@nearform.com',
  password: 'fakepassword',
  publishPatterns: ['sensor/lux/0']
}, (err) => {
  if (err) {
    throw err
  }
})

seneca.act({
  role: 'mosca-auth',
  cmd: 'register',
  nick: 'admin',
  email: 'matteo.collina@nearform.com',
  password: 'admin',
  publishPatterns: ['#'],
  subscribePatterns: ['#']
}, (err) => {
  if (err) {
    throw err
  }
})

server.on('published', function (packet) {

  if(!packet.topic.includes('sensor/lux'))
    return

  var topic = packet.topic.split('/')
  var sensor_id = topic[2]

  var metric = {
    source: 'mqtt',
    payload: {
      name: 'sensor.read',
      time: Date.now(),
      values: {
        value: packet.payload.toString(),
      },
      tags: {
        uom: 'lux',
        sensor_type: 'Light',
        sensor_id: sensor_id,
        broker_id: server.id,
        topic: `sensor/lux`
      }
    }
  }

  var payload = new Buffer(JSON.stringify(metric))
  var size = payload.length

  socket.send(payload, 0, size, '5001', 'localhost', (err) => {
    if (err) console.log(err)
  })
})
