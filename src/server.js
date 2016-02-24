var fs = require('fs');

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
  players: [{
    user_id: 3,
    ws: undefined,
  }, {
    user_id: 7,
    ws: undefined,
  }],
  chats: [],
  turn: 3,
  turns: [{
    user_id: 3,
    moves: [
      {
        type: 'draw',
        count: 3,
        cards: [{
          name: 'meteor',
        },{
          name: 'meteor',
        },{
          name: 'asteroid',
        }],
      }
    ],
  }],
},{
  id: 1,
  name: 'The second game ever',
  players: [{
    user_id: 3,
    ws: undefined,
  }, {
    user_id: 7,
    ws: undefined,
  }],
  chats: [],
  turn: 7,
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
      for (var j = 0; j < games[i].players.length; j++) {
        if (games[i].players[j].user_id == session.user_id) {
          var game_temp = {
            id: games[i].id,
            name: games[i].name,
            players: [],
          };
          for (var k = 0; k < games[i].players.length; k++) {
            game_temp.players.push({
              user_id: games[i].players[k].user_id,
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
  else {
    res.writeHead(404);
    res.end();
  }
}).listen(80);

var wss = new require('ws').Server({port: 8080});
wss.on('connection', function(ws) {
  var session = undefined;
  var game = undefined;
  var player = undefined;
  var user = undefined;

  var send = function(payload, to_player) {
    if (typeof to_player === 'undefined') {
      to_player = player;
    }
    to_player.ws.send(JSON.stringify(payload), function ack(error) {
      if (typeof error === 'undefined') {
        return;
      }
      if (error.message === 'not opened') {
        player.ws = undefined;
        console.log('player %s disconnected', player.user_id);
        return;
      }
      throw error;
    });
  }

  var prepare_turn_for_sending = function(user_id, turn) {
    var ret = JSON.parse(JSON.stringify(turn));

    // Don't need to strip out secrets if the turn belongs to the user
    console.log(">> %s %s", turn.user_id, user_id);
    if (turn.user_id != user_id) {
      for (var i = 0; i < ret.moves.length; i++) {
        if (ret.moves[i].type === 'draw') {
          ret.moves[i].cards = undefined;
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
        for (var j = 0; j < games[i].players.length; j++) {
          if (games[i].players[j].user_id == session.user_id) {
            game = games[i];
            player = game.players[j];
            break outer;
          }
        }
      }
      if (typeof game === 'undefined') {
        console.log('Game not found.');
        send({type: 'error', text: 'Game not found'});
        return;
      }
      player.ws = ws;
      console.log('user_id %s connected to game %s', session.user_id, game.id);
      send({type: 'chats', chats: game.chats});
      var turns_out = [];
      for (var i = 0; i < game.turns.length; i++) {
        turns_out.push(prepare_turn_for_sending(session.user_id,
              game.turns[i]));
      }
      send({type: 'turns', turns: turns_out});
      if (game.turn == player.user_id) {
        send({type: 'opponentYield'});
      }
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
      for (var i = 0; i < game.players.length; i++) {
        if (typeof game.players[i].ws !== 'undefined') {
          send(newMessage, game.players[i]);
        }
      }
    }
    else if (msg.type === 'yield') {
      if (game.turn != player.user_id) {
        console.log('player yielded when not their turn');
      }
      else {
        var old_turn = game.turn;
        for (var i = 0; i < game.players.length; i++) {
          if (game.players[i].user_id != player.user_id) {
            game.turn = game.players[i].user_id;
            if (typeof game.players[i].ws !== 'undefined') {
              send({type: 'opponentYield'}, game.players[i]);
            }
          }
        }
        console.assert(old_turn !== game.turn);
      }
    }
    else {
      console.log('unrecognized message type: %s', message);
    }
  });
});
