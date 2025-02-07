const socket = require('socket.io')
const assert = require('assert')

let io_
let socket_

function init(server) 
{
    if (io_) {   console.warn("Already initialized and Trying to init Socket.io again!");  return io_     }
    
    console.log('Launching socket server...')
    const io  = socket(server, { cors: { origin: '*' } })
       
    io.on('connection', (socket) => {
        console.log('New Socket Connection: ', socket.id )
    
        socket_ = socket
        
        socket.on('mouse', (data) => { // example used to share mouse movement between client - DrawTogether project
            socket.broadcast.emit('mouse', data) // io.sockets.emit()  will emit back to sender as well.  could be used if data is modified by server
        })
    })

    io_ = io
    return io_
}


function get_io() { assert.ok(io_, "IO has not been initialized. Please called init first.");   return io_  }

function get_socket() { assert.ok(socket_, "Socket has not been initialized. Please called init first."); return socket_  }
  


module.exports = {
  get_io,
  get_socket,
  init
};

