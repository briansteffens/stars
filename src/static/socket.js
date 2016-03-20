function clone(obj) {
  return JSON.parse(JSON.stringify(obj)); // TODO: something better
}

var game = {
  player_ids: [3, 7],
  moves: [],
  state: {},
};

var game_info = undefined;
var socket = undefined;
var view = undefined;

function connect_socket(token) {
  socket = new WebSocket('wss://' + location.hostname + '/ws/');
  socket.onerror = function(error) {
    console.log("WebSocket error: " + error);
  };
  socket.onopen = function(e) {
    socket.send(JSON.stringify({
      type: 'hello',
      token: token,
    }));
  };
  socket.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    if (msg.type === 'chat') {
      view.add(msg.chat);
    }
    else if (msg.type === 'chats') {
      for (var i = msg.chats.length - 1; i >= 0; i--) {
        view.add(msg.chats[i]);
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
}
