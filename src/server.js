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

var games = [
  {
    id: 0,
    name: 'The first game ever!',
    players: [3, 7],
  },
  {
    id: 1,
    name: 'The second game ever',
    players: [7, 3],
  },
];

require('http').createServer(function(req, res) {
  var url = require('url').parse(req.url, true);
  console.log("request: " + req.method + " " + req.url);

  if (url.pathname === '/') {
    var path = 'src/index.html';

    if (!(url.query.session in sessions)) {
      console.log('Bad session');
      res.writeHead(500);
      res.end();
    }

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': fs.statSync(path).size,
      'Set-Cookie': 'session_id=' + url.query.session,
    });

    return fs.createReadStream(path).pipe(res);
  }

  var cookies = require('cookie').parse(req.headers.cookie);
  var session = sessions[cookies.session_id];

  if (url.pathname === '/games') {
    var game_list = [];

    for (var i = 0; i < games.length; i++) {
      if (games[i].players.indexOf(session.user_id) >= 0) {
        game_list.push(games[i]);
      }
    }

    var json = JSON.stringify({games: game_list});

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': json.length,
    });

    res.end(json);
  }
  else {
    res.writeHead(404);
    res.end();
  }
}).listen(80);

var wss = new require('ws').Server({port: 8080});
wss.on('connection', function(ws) {
  var session_id = undefined;
  var chats = [];
  ws.on('message', function(message) {
    console.log('session %s: %s', session_id, message);
    var msg = JSON.parse(message);
    if (msg.type === 'hello') {
      console.log('session %s says hello', msg.session_id);
      session_id = msg.session_id;
    }
    else if (msg.type === 'chat') {
      chats.push(msg.text);
      console.log('chat history:');
      for (var i = 0; i < chats.length; i++) {
        console.log('chat %s: %s', i, chats[i]);
      }
      console.log();
    }
    else {
      console.log('unrecognized message type: %s', message);
    }
  });
  ws.send(JSON.stringify({
    text: 'something',
    index: 385
  }));
});
