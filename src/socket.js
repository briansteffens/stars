function clone(obj) {
  return JSON.parse(JSON.stringify(obj)); // TODO: something better
}
var game = {
  player_ids: [3, 7],
  moves: [],
  state: {},
};
var game_info = undefined;
var chat = undefined;
var socket = undefined;
var view = undefined;
window.onload = function() {
  var readCookie = function(name) {
    var c = document.cookie.split('; ');
    for (var i = c.length - 1; i >= 0; i--) {
      var cc = c[i].split('=');
      if (cc[0] === name) {
        return cc[1];
      }
    }
    throw 'Cookie '+name+' not found.';
  };

  socket = new WebSocket('ws://' + location.hostname + ':8080');
  socket.onerror = function(error) {
    console.log("WebSocket error: " + error);
  };
  socket.onopen = function(e) {
    console.log("WebSocket open");
    socket.send(JSON.stringify({
      type: 'hello',
      session_id: readCookie('session_id'),
      game_id: window.location.href.split('/').pop(),
    }));
  };
  socket.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.type === 'chat') {
      chat.add(msg.chat);
    }
    else if (msg.type === 'chats') {
      for (var i = msg.chats.length - 1; i >= 0; i--) {
        chat.add(msg.chats[i]);
      }
    }
    else if (msg.type === 'greetings') {
      game_info = msg;
      view.forceUpdate();
    }
    else if (msg.type === 'state') {
      view.set_state(msg.state);
    }
    else {
      console.log('Unrecognized WebSocket message type: %s', msg.type);
    }
  };
  socket.onclose = function(e) {
    console.log("WebSocket closed");
  };
};
