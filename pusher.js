var Pipe = require('pusher-pipe'),
    redis = require('./redis');
    
var md = require("node-markdown").Markdown;

var pipe = Pipe.createClient({
  key: '7d1978754fb5fce0a8e9',
  secret: 'ea42eae168f0b04d12d0',
  app_id: 26,
  debug: false,
  app_id: '31',
  key: '28e501df7286c5d180b0',
  secret: '8da8d65e91e665050bb7'
});

pipe.connect();

var users = [];
var rooms = {};

pipe.sockets.on('event:rage', function(socket_id, data) {
  if (data.fsid) {
    var user = -1;
    
    for (var i = 0; i < users.length; i++) {
      if (data.fsid == users[i].fsid) {
        user = i;
      }
    }
    
    if (user > -1) { // user exists on server
      redis.load_session(users[user].fsid, function(err, session) {
        if (err) {
          console.log(err);
          console.log(err.stack);
        } else {
          if (typeof session.user != "undefined") {
            users[user].username = session.user.username;
          } else {
            users[user].username = socket_id;
          }
          
          users[user].session = session;
          
          users[user].online = true;
        }
        
        for (var i = 0; i < users.length; i++) {
          pipe.socket(users[i].socket_id).trigger('user_count', {count: users.length});
        }
      });
      
      pipe.socket(socket_id).trigger('rejoin', users[user].channels);
    } else { // user does not exist yet
      redis.load_session(data.fsid, function(err, session) {
        if (err) {
          console.log(err);
          console.log(err.stack);
        } else {
          var u = {online: true, fsid: data.fsid, socket_id: socket_id, session: session, channels: []};
          
          if (typeof session.user != "undefined") {
            u.username = session.user.username;
          } else {
            u.username = socket_id;
          }
          
          var user = users.push(u) - 1;
          join_room(users[user], 'main');
          
          for (var i = 0; i < users.length; i++) {
            pipe.socket(users[i].socket_id).trigger('user_count', {count: users.length});
          }
        }
      });
    }
  }
});

pipe.sockets.on('event:join', function(socket_id, channel) {
  var channel = channel.channel;
  var fsid = channel.fsid;
  
  for (var i = 0; i < users.length; i++) {
    if (users[i].fsid == fsid) {
      join_room(users[i], channel);
    }
  }
});

pipe.sockets.on('event:message', function(socket_id, message) {
  var fsid = message.fsid;
  var channel = message.chan;
  var message = message.message;
  
  var found = null;
  
  for (var i = 0; i < users.length; i++) {
    if (users[i].fsid == fsid) {
      console.log('FOUND YOU');
      found = users[i];
    }
  }
  
  console.log('preparing to channel');
  if (found != null) {
    console.log('sending to channel ' + channel);
    
    var html = md(message, true);
    
    pipe.channel(channel).trigger('message', {message: html, nickname: found.username});
  }
});

pipe.sockets.on('close', function(socket_id) {
  for (var i = 0; i < users.length; i++) {
    if (users[i].socket_id == socket_id) {
      users[i].online = false;
      setTimeout(quit_user(users[i]), 3*1000);
    }
  }
});

function quit_user(user) {
  return function() {
    if (user.online == false) {
      var found = -1;
      for (var j = 0; j < user.channels.length; j++) {
        found = i;
        pipe.channel(user.channels[j]).trigger('quit', user.username);
      }
    }
    
    if (found > -1) {
      users.splice(found, 1);
      for (var i = 0; i < users.length; i++) {
        pipe.socket(users[i].socket_id).trigger('user_count', {count: users.length});
      }
    }
  };
}


function join_room(user, room) {
  console.log('USER IS JOINING YES');
  
  pipe.socket(user.socket_id).trigger('join', room);
  
  if (user.channels.indexOf(room) == -1) {
    pipe.channel(room).trigger('join', user.username);
    
    user.channels.push(room);
    
    if (rooms.hasOwnProperty(room)) {
      var found = -1;
      
      for (var i = 0; i < rooms[room].users.length; i++) {
        if (rooms[room].users[i].username == user.username) {
          found = i;
        }
      }
      
      if (found > -1) {
        rooms[room].users[found] = user;
        console.log('Readding user');
      } else {
        rooms[room].users.push(user);
        console.log('Adding user');
      }
    } else {
      create_room(room, user);
    }
  }
}

function create_room(room, user) {
  console.log('creating room');
  rooms[room] = {users: [user]};
  console.log(rooms);
}