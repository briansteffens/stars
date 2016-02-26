var fs = require('fs');
var state = require('./state.js');

var sessions = {
  'a': {
    user_id: 3,
  },
  'b': {
    user_id: 7,
  },
};

var users = {
  3: {
    username: 'brian',
  },
  7: {
    username: 'evilbrian',
  },
};

var games = [{
  id: 0,
  name: 'The first game ever!',
  player_ids: [3, 7],
  sockets: {
    3: undefined,
    7: undefined,
  },
  chats: [],
  moves: [{
    user_id: 3,
    turn: 0,
    type: 'draw',
    count: 1,
    cards: [{name: 'meteor'}],
  }, {
    user_id: 3,
    turn: 0,
    type: 'yield',
  }, {
    user_id: 7,
    turn: 1,
    type: 'draw',
    count: 1,
    cards: [{name: 'asteroid'}],
  }],
  state: {
    turn: 3,
    players: {
      3: {
        hand: [],
      },
      7: {
        hand: [],
      },
    },
  },
}];

require('http').createServer(function(req, res) {
  var url = require('url').parse(req.url, true);
  console.log("request: " + req.method + " " + req.url);

  var serveStatic = function(fn, headers) {
    if (typeof headers === 'undefined') {
      headers = {};
    }
    headers['Content-Type'] = 'text/html';
    headers['Content-Length'] = fs.statSync(fn).size;
    res.writeHead(200, headers);
    return fs.createReadStream(fn).pipe(res);
  };

  if (url.pathname === '/') {
    if (!(url.query.session in sessions)) {
      console.log('Bad session');
      res.writeHead(500);
      res.end();
    }
    return serveStatic('src/index.html', {
      'Set-Cookie': 'session_id=' + url.query.session,
    });
  }

  var cookies = require('cookie').parse(req.headers.cookie);
  var session = sessions[cookies.session_id];

  if (url.pathname === '/games') {
    var game_list = [];

    for (var i = 0; i < games.length; i++) {
      for (var j = 0; j < games[i].player_ids.length; j++) {
        if (games[i].player_ids[j] == session.user_id) {
          var game_temp = {
            id: games[i].id,
            name: games[i].name,
            players: [],
          };
          for (var k = 0; k < games[i].player_ids.length; k++) {
            game_temp.players.push({
              user_id: games[i].player_ids[k],
            });
          }
          game_list.push(game_temp);
          continue;
        }
      }
    }
    console.log(game_list);
    for (var x = 0; x < game_list.length; x++) {
      for (var y = 0; y < game_list[x].players.length; y++) {
        console.log(game_list[x].players[y]);
      }
    }
    var json = JSON.stringify({'games': game_list});

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': json.length,
    });

    res.end(json);
  }
  else if (url.pathname.startsWith('/game/')) {
    var game_id = url.pathname.replace('/game/', '');
    var game = undefined;
    for (var i = 0; i < games.length; i++) {
      if (games[i].id == game_id) {
        game = games[i];
        break;
      }
    }
    if (typeof game === 'undefined') {
      res.writeHead(404);
      res.end();
    }
    return serveStatic('src/game.html');
  }
  else if (url.pathname.startsWith('/state.js')) {
    return serveStatic('src/state.js');
  }
  else {
    res.writeHead(404);
    res.end();
  }
}).listen(80);

var wss = new require('ws').Server({port: 8080});
wss.on('connection', function(ws) {
  var session = undefined;
  var game = undefined;
  var player_id = undefined;
  var user = undefined;

  var send = function(payload, to_player) {
    if (typeof to_player === 'undefined') {
      to_player = player_id;
    }
    game.sockets[to_player].send(JSON.stringify(payload), function ack(error) {
      if (typeof error === 'undefined') {
        return;
      }
      if (error.message === 'not opened') {
        game.sockets[to_player] = undefined;
        console.log('player %s disconnected', to_player);
        return;
      }
      throw error;
    });
  }

  var prepare_move_for_sending = function(user_id, move) {
    var ret = JSON.parse(JSON.stringify(move));

    // Don't need to strip out secrets if the move belongs to the user
    if (move.user_id != user_id) {
      if (ret.type === 'draw') {
        for (var c = 0; c < ret.cards.length; c++) {
          ret.cards[c] = {'name': 'unknown'};
        }
      }
    }

    return ret;
  }

  ws.on('message', function(message) {
    console.log('session %s: %s', session, message);
    var msg = JSON.parse(message);
    if (msg.type === 'hello') {
      console.log('session %s says hello', msg.session_id);
      session = sessions[msg.session_id];
      user = users[session.user_id];
      outer: for (var i = 0; i < games.length; i++) {
        for (var j = 0; j < games[i].player_ids.length; j++) {
          if (games[i].player_ids[j] == session.user_id) {
            game = games[i];
            player_id = game.player_ids[j];
            break outer;
          }
        }
      }
      if (typeof game === 'undefined') {
        console.log('Game not found.');
        send({type: 'error', text: 'Game not found'});
        return;
      }
      game.sockets[player_id] = ws;
      console.log('user_id %s connected to game %s', session.user_id, game.id);
      send({
        type: 'greetings',
        user_id: session.user_id,
        username: user.username,
      });
      send({type: 'chats', chats: game.chats});
      var moves_out = [];
      for (var i = 0; i < game.moves.length; i++) {
        moves_out.push(prepare_move_for_sending(player_id, game.moves[i]));
      }
      send({type: 'moves', moves: moves_out});
    }
    else if (msg.type === 'chat') {
      var newMessage = {
        type: 'chat',
        chat: {
          username: user.username,
          timestamp: Date.now(),
          text: msg.text,
        }
      };
      game.chats.splice(0, 0, newMessage.chat);
      for (var i = 0; i < game.player_ids.length; i++) {
        if (typeof game.sockets[game.player_ids[i]] !== 'undefined') {
          send(newMessage, game.player_ids[i]);
        }
      }
    }
    else if (msg.type === 'yield') {
      msg.user_id = player_id;
      msg.turn = state.current_turn(game);
      game.moves.push(msg);
      game.state = state.apply_move(game, game.state, msg);
      if (typeof game.sockets[player_id] !== 'undefined') {
        send(msg);
      }
      var other_player = state.next_player(game, player_id);
      if (typeof game.sockets[other_player] !== 'undefined') {
        send(msg, other_player);
      }
    }
    else {
      console.log('unrecognized message type: %s', message);
    }
  });
});
