var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var crypto = require('crypto');
var seedrandom = require('seedrandom');
var bcrypt = require('bcryptjs');
var redis = require("redis").createClient();
var mongojs = require('mongojs');
var nodemailer = require('nodemailer');
require('./static/common.js');
var cards = require('./cards.js');
var state = require('./state.js');
var config = require('./config.js');

const DEBUG = process.argv.contains('--debug');
const MAX_KEY_ATTEMPTS = 5;
const GAME_TOKEN_TTL = 5 * 60;
const EMAIL_CONFIRM_TTL = 24 * 60;

// Setup mongo database connection
var db = mongojs('stars', ['users']);

db.users.remove();

function makeUnique(field, options, cb) {
  db.users.createIndex([field], options, function(err, list) {
    if (err) {
      throw 'Error making '+field+' unique';
    }
    cb();
  });
}

makeUnique('email', {unique: true}, function() {
  makeUnique('username', {unique: true}, function() {
    makeUnique('verificationCode', {unique: true,sparse: true}, function() {
      db.users.save({
        username: 'brian',
        email: 'brian@asdf.com',
        password: bcrypt.hashSync('password'),
      });
      db.users.save({
        username: 'jeremy',
        email: 'jeremy@asdf.com',
        password: bcrypt.hashSync('password'),
      });
      db.users.save({
        username: 'levi',
        email: 'levi@asdf.com',
        password: bcrypt.hashSync('password'),
      });
    });
  });
});

// Email config
var transporter = nodemailer.createTransport(config.mail.transport);

var games = [];

var allCards = cards.all();
var exploreCards = cards.explore();
var randomPool = cards.pool(allCards);

/* Return a redis callback that logs any found error in a standardized format
 * with [msg] as descriptive text, then calls the optional [cb] callback
 * with signature (err, res).
 */
function redisErr(msg, cb) {
  return function(err, res) {
    if (err) {
      console.log('REDIS ERROR: '+msg+'\n err: ['+err+']\n res: ['+res+']\n');
    }

    if (cb) {
      cb(err, res);
    }
  }
}

/* Store [val] in redis with a generated base64 key of length [keyLen] with
 * a prefix of "[prefix]_".
 *
 * [cb] should be a function with the signature (err, key). [err] will be
 * non-null if a unique key could not be generated. [key] will contain the
 * generated key if [err] is null.
 */
function redisSet(prefix, keyLen, val, ttl, cb) {
  let tries = MAX_KEY_ATTEMPTS;

  let attempt = function() {
    let key = prefix + '_' + randomBase64(keyLen);

    redis.set(key, val, 'NX', 'EX', ttl, function(err, res) {
      if (res !== 'OK') {
        tries--;
        if (tries <= 0) {
          cb('Max attempts exceeded trying to generate a unique key', null);
        }
        attempt();
        return;
      }

      cb(null, key);
    });
  };

  attempt();
}

function getUserByID(id, cb) {
  db.users.findOne({_id: mongojs.ObjectId(id)}, function(err, doc) {
    if (err) {
      throw 'Unable to find user id: '+id;
    }

    cb(doc);
  });
}

/* Send email from the configured user
 *
 * cb should have a signature of (err, info)
 */
function email(to, subject, text, cb) {
  var options = {
    from: config.mail.from,
    to: to,
    subject: subject,
    text: text,
  };

  transporter.sendMail(options, cb);
}

function randomBase64(len) {
  return crypto.randomBytes(Math.ceil(len * 3 / 4))
    .toString('base64')
    .slice(0, len)
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateId(len, collisionCheck) {
  let id = null;

  do {
    id = randomBase64(len);
  } while (collisionCheck(id));

  return id;
}

passport.use(new Strategy(function(username, password, cb) {
  db.users.findOne({username: username}, function(err, doc) {
    if (err) {
      return cb('Invalid username');
    }

    bcrypt.compare(password, doc.password, function(err, res) {
      if (!res) {
        return cb('Invalid password');
      } else {
        return cb(null, doc);
      }
    });
  });
}));

passport.serializeUser(function(user, cb) {
  cb(null, user._id.toString());
});

passport.deserializeUser(function(userId, cb) {
  getUserByID(userId, function(user) {
    cb(null, user);
  });
});

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true}));
app.use(require('body-parser').json());
app.use(require('express-session')({secret: 'keyboard cat', resave: false,
  saveUnitialized: false}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static('src/static'));

app.get('/', function(req, res) {
  res.redirect('/games');
});

app.get('/register', function(req, res) {
  res.render('register');
});

app.post('/register', function(req, res) {
  let errors = [];

  if (req.body.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (req.body.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (req.body.password !== req.body.passwordConfirm) {
    errors.push('Passwords must match');
  }

  // Check username availability
  db.users.findOne({username: req.body.username}, function(err, doc) {
    if (doc) {
      errors.push('Username is already taken');
    }

    let renderErrors = function(errors) {
      res.render('register', {
        email: req.body.email,
        username: req.body.username,
        errors: errors,
      });
    }

    // Check email availability
    db.users.findOne({email: req.body.email}, function(err, doc) {
      if (doc) {
        errors.push('Email already registered');
      }

      if (errors.length > 0) {
        return renderErrors(errors);
      } else {
        // Process registration
        let verificationCode = randomBase64(32);

        bcrypt.hash(req.body.password, 8, function(err, hash) {
          db.users.save({
            email: req.body.email,
            username: req.body.username,
            password: hash,
            registeredAt: Date.now(),
            verifiedAt: null,
            verificationCode: verificationCode,
          }, function(err, list) {
            if (err) {
              console.log('Error inserting user: ' + err);
              return renderErrors([
                  'Unknown error creating the account, please try again']);
            }

            let body = 'Thanks for registering! Verify your email address by '+
                       'clicking here: ' + config.externalUrl + 'register/' +
                       verificationCode;

            email(req.body.email, 'stars: verify email address', body,
                function(err, info) {
              if (err) {
                console.log('MAIL ERROR: ' + err);
                return renderErrors([
                    'Unknown error sending a verify email, please try again']);
              }

              console.log('MAIL SENT: ' + info.response);
              res.render('registered');
            });
          });
        });
      }
    });
  });
});

app.get('/register/:code', function(req, res) {
  db.users.findOne({verificationCode: req.params.code}, function(err, user) {
    if (err || !user || user.verifiedAt) {
      return res.render('register_fail');
    }

    user.verificationCode = null;
    user.verifiedAt = Date.now();

    db.users.save(user, function(err, doc) {
      if (err) {
        return res.render('register_fail');
      }

      return res.render('register_complete');
    });
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/games', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }
  res.render('games', {user: req.user});
});

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login?fail=1' }),
  function(req, res) {
    res.redirect('/');
  }
);

let gamesInfo = function(userId, cb) {
  var gameList = [];
  for (var i = 0; i < games.length; i++) {
    for (var j = 0; j < games[i].playerIDs.length; j++) {
      if (games[i].playerIDs[j] == userId) {
        var gameTemp = {
          id: games[i].id,
          name: games[i].name,
          players: [],
          state: {
            winner: games[i].state.winner,
          },
        };
        for (var k = 0; k < games[i].playerIDs.length; k++) {
          gameTemp.players.push({
            userId: games[i].playerIDs[k],
          });
        }
        gameList.push(gameTemp);
        continue;
      }
    }
  }

  db.users.find({_id: {$ne: mongojs.ObjectId(userId)}}, function(err, docs) {
    if (err) {
      throw 'Error getting user list';
    }

    cb({
      games: gameList,
      users: docs,
    });
  });
};

app.get('/games/info', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  gamesInfo(req.user._id.toString(), function(r) {
    res.json(r);
  });
});

app.post('/games/new', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  let game = {
    id: null,
    name: req.body.name,
    playerIDs: [req.user._id.toString(), req.body.against],
    sockets: {},
    chats: [],
    moves: [],
    rng: seedrandom(Math.random()),
    state: {
      winner: undefined,
      turn: -1,
      turnPlayerId: null,
      phase: 'pre-game',
      drawPossible: 0,
      canExplore: 0,
      attacks: [],
      nextCopyId: 0,
      players: {},
      log: [],
    },
  };

  game.id = generateId(5, function(id) {
    for (let g of games) {
      if (g.id == id) {
        return true;
      }
    }
    return false;
  });

  game.sockets[req.user._id.toString()] = undefined;
  game.sockets[req.body.against] = undefined;

  let makePlayer = function(id, cb) {
    getUserByID(id, function(user) {
      cb({
        userId: user._id.toString(),
        userName: user.username,
        hand: [],
        deck: [],
        permanents: [],
        scrap: 0,
        cantPlay: [],
        powerUsed: 0,
        powerTotal: 0,
        shieldsUsed: 0,
        shieldsTotal: 0,
        ready: false,
        mullPenalty: -1,
      });
    });
  }

  makePlayer(req.user._id, function(user1) {
    game.state.players[req.user._id] = user1;

    makePlayer(req.body.against, function(user2) {
      game.state.players[req.body.against] = user2;

      let randomCard = function() {
        return randomPool[Math.floor(Math.random() * randomPool.length)];
      }

      let findCard = function(name) {
        for (let coll of [allCards, exploreCards]) {
          for (let card of coll) {
            if (card.name == name) {
              return card;
            }
          }
        }
        throw 'Cannot find card ['+name+']';
      }

      let nextCard = function(card) {
        var card = JSON.parse(JSON.stringify(card));
        card.copyId = game.state.nextCopyId++;
        card.tapped = false;
        card.powered = false;
        return card;
      }

      let nextMotherShip = function() {
        var ret = cards.motherShip();
        ret.copyId = game.state.nextCopyId++;
        return ret;
      }

      let playerIDs = [req.user._id.toString(), req.body.against];

      for (let playerId of playerIDs) {
        for (var i = 0; i < 50; i++) {
          game.state.players[playerId].deck.push(nextCard(randomCard()));
        }

        game.state.players[playerId].permanents.push(nextMotherShip());
      }

      if (DEBUG) {
        let initial = ['blue supergiant','brown dwarf','desert planet',
          'red giant','rocky planet','white dwarf','yellow dwarf'];

        for (let name of initial) {
          game.state.players[req.user._id].hand.push(
              nextCard(findCard(name)));
        }
      }
      else {
        for (let playerId of playerIDs) {
          state.applyMove(game, {
            type: 'mull',
            userId: playerId,
            turn: game.state.turn,
          });
        }
      }

      games.push(game);

      gamesInfo(req.user._id.toString(), function(r) {
        res.json(r);
      });
    });
  });
});

app.get('/game', function(req, res) {
  if (req.user === undefined) {
    return res.redirect('/login');
  }

  let game = null;

  for (let i = 0; i < games.length; i++) {
    if (games[i].playerIDs.contains(req.user._id.toString())) {
      game = games[i];
      break;
    }
  }

  if (game === null) {
    return res.status(404).send('Not found');
  }

  let tokenData = JSON.stringify({
    gameId: game.id,
    userId: req.user._id.toString(),
  });

  redisSet('wstoken', 10, tokenData, GAME_TOKEN_TTL, function(err, token) {
    if (err) {
      console.log('Error generating token: ' + err);
      return res.status(500).send('Error generating token');
    }

    res.render('game', {
      user: req.user,
      token: token.replace('wstoken_', ''),
    });
  });
});

app.listen(8080);

var wss = new require('ws').Server({port: 8081});
wss.on('connection', function(ws) {
  let tokenData = undefined;
  let game = undefined;
  let playerId = undefined;
  let user = undefined;

  // Add implicit properties to a move originating from a client
  var fillIn = function(move) {
    move.userId = playerId;
    move.turn = state.turn;
    return move;
  };

  var send = function(payload, toPlayer) {
    if (toPlayer === undefined) {
      toPlayer = playerId;
    }
    var socket = game.sockets[toPlayer];
    if (socket === undefined) {
      return;
    }
    socket.send(JSON.stringify(payload), function ack(error) {
      if (error === undefined) {
        return;
      }
      if (error.message === 'not opened') {
        game.sockets[toPlayer] = undefined;
        console.log('player %s disconnected', toPlayer);
        return;
      }
      throw error;
    });
  };

  var sendState = function(toPlayer) {
    send({
      type: 'state',
      state: state.stripState(game.state, toPlayer),
    }, toPlayer);
  };

  ws.on('message', function(message) {
    var msg = JSON.parse(message);
    if (msg.type === 'connect') {
      redis.get('wstoken_' + msg.token, redisErr('token get failed',
            function(err, res) {
        if (err || res === null) {
          return send({type: 'error', text: 'Invalid or expired token'});
        }

        tokenData = JSON.parse(res);
        redis.del(msg.token, redisErr('token delete failed'));

        getUserByID(tokenData.userId, function(user_) {
          user = user_;

          if (msg.page === 'game') {
            outer: for (let i = 0; i < games.length; i++) {
              if (games[i].id == tokenData.gameId) {
                game = games[i];
                for (let j = 0; j < game.playerIDs.length; j++) {
                  if (game.playerIDs[j] == tokenData.userId) {
                    playerId = game.playerIDs[j];
                    break outer;
                  }
                }
              }
            }

            if (playerId === undefined) {
              console.log('Game not found.');
              send({type: 'error', text: 'Game not found'});
              return;
            }

            game.sockets[playerId] = ws;
            console.log('userId %s connected to game %s', user._id, game.id);
            send({
              type: 'greetings',
              userId: user._id,
              username: user.username,
            });
            send({type: 'chats', chats: game.chats});
            sendState(playerId);
          } else {
            send({type: 'error', text: 'Unrecognized page'});
          }
        });
      }));
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
      for (var i = 0; i < game.playerIDs.length; i++) {
        if (game.sockets[game.playerIDs[i]] !== undefined) {
          send(newMessage, game.playerIDs[i]);
        }
      }
    }
    else {
      msg = fillIn(msg);
      try {
        state.applyMove(game, msg);
      } catch (ex) {
        console.log("EXCEPTION in applyMove: " + ex);
      }
      sendState(playerId);
      sendState(state.nextPlayer(game, playerId));
    }
  });
});
