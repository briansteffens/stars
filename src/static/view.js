var gameInfo = undefined;
var socket = undefined;

var View = React.createClass({
  getInitialState: function() {
    return {
      game: null,
      source: null,
      action: null,
      selection: null,
      chats: [],
    };
  },
  renderCanvas: function() {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (this.state.game === null) {
      return;
    }

    let game = this.state.game;

    ctx.strokeStyle = 'rgb(200, 0, 0)';
    ctx.lineWidth = 3;

    var drawAttackLine = function(topEl, bottomEl) {
      ctx.beginPath();
      ctx.moveTo(topEl.offsetLeft + topEl.offsetWidth / 2,
                 topEl.offsetTop + topEl.offsetHeight + 1);
      ctx.lineTo(bottomEl.offsetLeft + bottomEl.offsetWidth / 2,
                 bottomEl.offsetTop - 1);
      ctx.stroke();
    };

    var myTurn = game.turnPlayerId == gameInfo.userId;

    for (let attack of game.attacks) {
      let attackerEl = document.getElementById(`perm_${attack.attacker}`);
      let targetEl = document.getElementById(`perm_${attack.target}`);

      if (myTurn && game.phase === 'main' ||
          !myTurn && game.phase === 'defend') {
        drawAttackLine(attackerEl, targetEl);
      } else {
        drawAttackLine(targetEl, attackerEl);
      }
    }
  },
  componentDidMount: function() {
    setTimeout(function() {
      connectSocket({
        type: 'connect',
        page: 'game',
        token: gameSocketToken,
      });
    });
  },
  yield: function(e) {
    socket.send(JSON.stringify({type: 'yield'}));
  },
  draw: function(e) {
    socket.send(JSON.stringify({type: 'draw'}));
  },
  explore: function(e) {
    socket.send(JSON.stringify({type: 'explore'}));
  },
  play: function(card, e) {
    if (card.types.indexOf('instant') >= 0) {
      this.targetStart(card, card.actions[0], e);
    } else {
      socket.send(JSON.stringify({type: 'play',copyId: card.copyId}));
    }
  },
  updateState: function(fields) {
    let newState = {};

    for (let field of ['game','action','source','chats','selection']) {
      if (fields[field] !== undefined) {
        newState[field] = fields[field];
      } else {
        try {
          newState[field] = clone(this.state[field]);
        } catch (e) {
          newState[field] = this.state[field];
        }
      }
    }

    this.setState(newState);

    bodyEl.onresize();

    window.requestAnimationFrame(function() {
      let log = document.getElementById("log");
      log.scrollTop = log.scrollHeight;
    });
  },
  select: function(card, e) {
    this.updateState({
      selection: card.copyId,
    });
  },
  targetStart: function(source, action, e) {
    e.stopPropagation();

    this.updateState({
      action: action,
      source: source,
    });
  },
  targetCancel: function(e) {
    this.updateState({
      action: null,
      source: null,
    });
  },
  targetFinish: function(target, e) {
    e.stopPropagation();

    socket.send(JSON.stringify({
      type: 'action',
      source: this.state.source.copyId,
      action: this.state.action.name,
      target: target.copyId,
    }));

    this.targetCancel(e);
  },
  togglePower: function(card, e) {
    socket.send(JSON.stringify({
      type: 'togglePower',
      card: card.copyId,
    }));
  },
  scrap: function(card, e) {
    socket.send(JSON.stringify({
      type: 'scrap',
      card: card.copyId,
    }));
  },
  shields: function(card, delta, e) {
    socket.send(JSON.stringify({
      type: 'shields',
      card: card.copyId,
      delta: delta,
    }));
  },
  defend: function(e) {
    socket.send(JSON.stringify({type: 'defend'}));
  },
  ready: function(e) {
    socket.send(JSON.stringify({type: 'ready'}));
  },
  mull: function(e) {
    socket.send(JSON.stringify({type: 'mull'}));
  },
  forfeit: function(e) {
    if (!confirm('Forfeit the game?')) {
      return;
    }
    socket.send(JSON.stringify({type: 'forfeit'}));
  },
  send: function(e) {
    e.preventDefault();
    socket.send(JSON.stringify({
      type: 'chat',
      text: this.refs.message.value,
    }));
    this.refs.message.value = '';
    this.refs.message.blur();
  },
  add: function(msg) {
    this.updateState({
      chats: [msg, ...this.state.chats],
    });
    window.requestAnimationFrame(function() {
      let messages = document.getElementById("messages");
      messages.scrollTop = messages.scrollHeight;
    });
  },
  getAction: function(card, actionName) {
    for (let action of card.actions) {
      if (action.name === actionName) {
        return action;
      }
    }
    return null;
  },
  keyPress: function(e) {
    if (e.key === 'Escape') {
      this.updateState({
        action: null,
        source: null,
      });
      return true;
    }
    if (e.key === 'Tab') {
      if (this.state.selection === null) {
        let newSelection = this.getMe().permanents[0] ||
          this.getEnemy().permanents[0];
        if (newSelection !== undefined) {
          this.updateState({selection: newSelection.copyId});
        }
        return true;
      }

      let selInfo = this.getCardInfo(this.state.selection);
      let container = selInfo.container;
      let index = container.indexOf(selInfo.card) + 1;

      if (index >= container.length) {
        index = 0;

        if (selInfo.isMine) {
          container = this.getEnemy().permanents;
        } else {
          container = this.getMe().permanents;
        }
      }

      this.updateState({selection: container[index].copyId});
      return true;
    }
    if (this.state.selection !== null) {
      let cardInfo = this.getCardInfo(this.state.selection);
      if (cardInfo.isPerm) {
        if (e.key.toLowerCase() === 't') {
          if (this.isTargeting(cardInfo)) {
            this.targetFinish(cardInfo.card);
          }
          return true;
        }
        if (cardInfo.isMine) {
          if (e.key.toLowerCase() === 'a') {
            let action = this.getAction(cardInfo.card, 'attack');
            if (action !== null) {
              this.targetStart(cardInfo.card, action);
            }
          }
        } else {
        }
      }
    }
    return false;
  },
  getCardInfo: function(copyId) {
    let me = this.getMe();
    for (let owner of [me, this.getEnemy()]) {
      for (let containerName of ['permanents', 'hand']) {
        for (let test of owner[containerName]) {
          if (test.copyId == this.state.selection) {
            return {
              card: test,
              isMine: owner === me,
              isPerm: containerName === 'permanents',
              containerName: containerName,
              container: owner[containerName],
            };
          }
        }
      }
    }
    return null;
  },
  getMe: function() {
    return this.state.game.players[gameInfo.userId];
  },
  getEnemy: function() {
    for (let key in this.state.game.players) {
      if (this.state.game.players.hasOwnProperty(key) &&
          key != gameInfo.userId) {
        return this.state.game.players[key];
      }
    }
    throw 'enemy not found';
  },
  isMyTurn: function() {
    return this.state.game.turnPlayerId == gameInfo.userId;
  },
  isTargeting: function(cardInfo) {
    if (!cardInfo.isPerm || !this.isMyTurn() ||
        this.state.action === null) {
      return false;
    }

    let targets = this.state.action.targeting;

    let ownershipMatch = false;
    if (targets.contains('friendly')) {
      ownershipMatch = cardInfo.isMine;
    } else if (targets.contains('enemy')) {
      ownershipMatch = !cardInfo.isMine;
    }

    return ownershipMatch &&
      targets.intersect(cardInfo.card.types).length > 0;
  },
  render: function() {
    var game = this.state.game;

    if (gameInfo === undefined || game === null) {
      return (<i>Connecting..</i>);
    }

    var that = this;
    var me = this.getMe();
    var enemy = this.getEnemy();
    var myTurn = this.isMyTurn();

    let renderCard = function(card, isMine, isPerm) {
      let cls = 'card';

      if (that.state.selection && that.state.selection == card.copyId) {
        cls += ' sel';
      }

      if (card.upkeep && !card.powered) {
        cls += ' card-off';
      }

      const attack = card.attack > 0 ? card.attack : 0;
      const defense = card.defense > 0 ? card.defense : 0;
      const stats = card.attack || card.defense ? `${attack}/${defense}` : '';

      let details = [];

      if (card.power) {
        details.push(<div>{`Generates ${card.power} power`}</div>);
      }

      if (card.cost && !isPerm) {
        details.push(<div>{`Costs ${card.cost}`}</div>);
      }

      if (card.upkeep) {
        details.push(<div>{`${card.upkeep} to power`}</div>);
      }

      // Power button
      let power = '';
      if (isMine && card.upkeep) {
        const canPower = card.powered ||
                          me.powerUsed + card.upkeep <= me.powerTotal;

        const cantToggle = card.tapped || !canPower;

        const iconType = card.powered ? 'full' : 'empty';
        const batteryClass = cantToggle ? 'icon-disabled' : 'battery';

        power = (
          <i
            onClick={that.togglePower.bind(null, card)}
            className={`fa ${batteryClass} fa-battery-${iconType}`}
          >
          </i>
        );
      }

      // Action buttons
      let actions = [];
      if (isMine) {
        for (let i = 0; i < card.actions.length; i++) {
          let action = card.actions[i];
          let canAttack = isPerm && myTurn && that.state.action === null
              && !card.tapped;
          if (!card.types.contains('black_hole')) {
            canAttack = canAttack && card.powered;
          }

          let cls = 'question-circle';

          if (action.name === 'attack') {
            cls = 'plane';
          }

          if (canAttack) {
            cls += ' attack';
          } else {
            cls += ' icon-disabled';
          }

          actions.push(
            <i
              className={`fa fa-lg fa-${cls}`}
              key={action.name}
              onClick={that.targetStart.bind(null, card, action)}
              disabled={!canAttack}
            ></i>
          );
        }
      }

      // Target button
      const cardInfo = { // TODO: maybe take cardInfo as an arg to this func?
        card: card,
        isMine: isMine,
        isPerm: isPerm,
      };
      let target = '';
      if (that.isTargeting(cardInfo)) {
        target = (
          <i
            className="fa fa-lg fa-crosshairs target"
            onClick={that.targetFinish.bind(null, card)}
          ></i>
        );
      }

      // Scrap button
      let scrap = '';
      if (isMine && (card.types.intersect(['ship','instant']).length > 0) &&
          card.name !== 'mother ship') {
        scrap = (
          <i
            className="fa fa-lg fa-window-close-o scrap"
            disabled={!myTurn}
            onClick={that.scrap.bind(null, card)}
          ></i>
        );
      }

      return (
        <div
          id={'perm_' + card.copyId}
          key={card.copyId}
          className={cls}
          onClick={that.select.bind(that, card)}
        >
          <div className="title">{card.name}</div>
          <div className="stats">{stats}</div>
          <img src={'/img/' + card.image} />
          <div className="details">
            {details}
          </div>
          <div>
            {power}
            {actions}
            {target}
            {scrap}
          </div>
        </div>
      );
    };

    let renderPermanents = function(perms, areMine) {
      let ret = [];

      for (let perm of perms) {
        if (perm.name === 'mother ship') {
          ret.push(renderCard(perm, areMine, true));
        }
      }

      for (let perm of perms) {
        if (perm.name !== 'mother ship' && perm.types.contains('generator')) {
          ret.push(renderCard(perm, areMine, true));
        }
      }

      for (let perm of perms) {
        if (perm.name !== 'mother ship' && !perm.types.contains('generator')) {
          ret.push(renderCard(perm, areMine, true));
        }
      }

      return ret;
    };

    let permanents = renderPermanents(me.permanents, true);
    let enemyPermanents = renderPermanents(enemy.permanents);

    let gameover = '';
    if (game.winner !== undefined) {
      let outcome = game.winner == gameInfo.userId ? 'won' : 'lost';
      gameover = (<h3>Game over! You {outcome}!</h3>);
    }

    let renderPower = function(player) {
      return (
        <span className="power">
          {player.powerTotal - player.powerUsed}/{player.powerTotal}
        </span>
      );
    };

    let renderShields = function(player) {
      return (<span className="shields">
          {player.shieldsUsed}/{player.shieldsTotal}</span>);
    }

    let pregame = '';
    if (game.phase === 'pre-game') {
      let enemyReady = '';
      if (enemy.ready) {
        enemyReady = (<span>the other player is ready</span>);
      }
      pregame = (
        <span>
          <input type="button" onClick={this.mull} value="mull"
            disabled={me.ready} />
          <input type="button" onClick={this.ready} value="ready"
            disabled={me.ready} />
          {enemyReady}
        </span>
      );
    }

    let cancelTargetButton = '';
    if (this.state.action !== null) {
      cancelTargetButton = (
        <input type="button" onClick={this.targetCancel}
          value="cancel action" />
      );
    }

    let hud = '';
    if (pregame !== '') {
      hud = (<div id="hud" className="hud">{pregame}</div>);
    } else {
      let defend = '';
      if (myTurn && game.phase === 'defend') {
        defend = (
          <input type="button" onClick={this.defend} value="defend"
            disabled={!myTurn || game.phase !== 'defend'} />
        );
      }

      hud = (
        <div id="hud" className="hud">
          {pregame}
          {gameover}
          It is <strong>{myTurn ? '' : 'not '}your turn</strong>.
          Phase: <strong>{game.phase}</strong>
          {defend}
          <input type="button" onClick={this.yield} value="yield"
            disabled={!myTurn || game.phase !== 'main'} />
          <input type="button" onClick={this.forfeit} value="forfeit"
            disabled={game.winner !== undefined} />
          {cancelTargetButton}
          <div className="stats">
            &nbsp;
            Scrap: {me.scrap}
            &nbsp;
            Power: {renderPower(me)}
            &nbsp;
            Shields: {renderShields(me)}
          </div>
        </div>
      );
    }

    let chats = [];
    for (let i = this.state.chats.length - 1; i >= 0; i--) {
      let chat = this.state.chats[i];
      chats.push(
        <div key={i}>
          <strong>{chat.username}</strong>:
          &nbsp;
          {chat.text}
        </div>
      );
    }

    let chat = (
      <div className="chat_container">
        <div className="chat">
          <div id="messages" className="messages">
            {chats}
          </div>
          <form onSubmit={this.send}>
            <button className="submit">send</button>
            <span>
              <input id="chat_message" type="text" placeholder="enter a message"
                ref="message" />
            </span>
          </form>
        </div>
      </div>
    );

    let renderSelection = function() {
      if (!that.state.selection) {
        return (<div />);
      }

      let cardInfo = that.getCardInfo(that.state.selection);
      if (cardInfo === null) {
        console.log('Cannot find card container');
        return (<div />);
      }

      let card = cardInfo.card;
      let isMine = cardInfo.isMine;
      let isPerm = cardInfo.isPerm;

      let actions = [];
      let target = '';
      let play = '';
      let shields = '';
      let effects = '';
      let mass = '';

      if (isPerm) {
        // Shields
        if (card.shields !== undefined &&
            card.types.intersect(['generator','black_hole']).length == 0) {
          shields = (<span>shields: {card.shields}</span>);

          if (isMine) {
            shields = (
              <div className="shields">
                <input type="button" value="-"
                    onClick={that.shields.bind(null, card, -1)}
                    disabled={!myTurn || card.shields <= 0} />
                {shields}
                <input type="button" value="+"
                    onClick={that.shields.bind(null, card, 1)}
                    disabled={!myTurn ||
                              me.shieldsTotal - me.shieldsUsed <= 0 ||
                              me.powerTotal - me.powerUsed <= 0} />
              </div>
            );
          }
        }

        // Effects
        if (card.effects !== undefined) {
          let eles = [];

          for (let effect of card.effects) {
            eles.push(
              <div key={effect.name} className="effect">
                {effect.name}
              </div>
            );
          }

          effects = (<div>{eles}</div>);
        }

        // Mass
        if (card.mass !== undefined) {
          mass = (<div>mass: {card.mass}</div>);
        }
      }

      let upkeep = '';
      if (card.upkeep !== undefined) {
        upkeep = (<div>upkeep: {card.upkeep}</div>);
      }

      let cost = '';
      if (card.cost !== undefined) {
        cost = (<div>cost: {card.cost}</div>);
      }

      let worth = '';
      if (card.worth !== undefined) {
        worth = (<div>worth: {card.worth}</div>);
      }

      let orZero = function(v) { return v !== undefined ? v : 0 };

      let stats = '';
      if (card.types.contains('ship')) {
        stats = orZero(card.attack) + '/' + orZero(card.hp);
      }

      let classes = 'permanent';
      for (let cls of ['generator', 'black_hole']) {
        if (card.types.contains(cls)) {
          classes += ' ' + cls;
        }
      }

      let generates = '';
      if (card.power !== undefined) {
        generates = (<div>generates {card.power}</div>);
      }

      return (
        <div>
          {target}
          <div className="title">{card.name+" "}</div>
          {effects}
          {generates}
          <div>{stats}</div>
          {mass}
          {play}
          {shields}
          {actions}
          {upkeep}
          {cost}
          {worth}
        </div>
      );
    }

    let renderHand = function() {
      let hand = [];

      for (let card of me.hand) {
        let scrap = '';
        if (card.types.intersect(['ship','instant']).length > 0) {
          scrap = (<button onClick={that.scrap.bind(null, card)}
            disabled={!myTurn}>scrap</button>);
        }

        hand.push(
          <div key={card.copyId} className="hand-card">
            {card.name}
            <button onClick={that.play.bind(that, card)} disabled={!myTurn}>
              play</button>
            {scrap}
          </div>
        );
      }

      let drawPossible = myTurn ? game.drawPossible : 0;
      let explorePossible = myTurn ? game.canExplore : 0;

      return (
        <div id="hand">
          <input type="button" onClick={that.draw}
            value={'draw (' + drawPossible + ')'}
            disabled={!drawPossible} />
          <input type="button" onClick={that.explore}
            value={'explore (' + explorePossible + ')'}
            disabled={!explorePossible} />
          <div id="cards">{hand}</div>
        </div>
      );
    }

    let renderLog = function() {
      let log = [];
      for (let index = 0; index < game.log.length; index++) {
        let entry = game.log[index];
        log.push(<div key={index}>{entry.message}</div>);
      }

      return (<div id="log">{log}</div>);
    }

    // Update canvas after all changes have been flushed to the DOM
    setTimeout(
      () => window.requestAnimationFrame(() => view.renderCanvas()), 0);

    return (
      <div>
        {hud}
        <div id="hud-spacer" />
        <div>{permanents}</div>
        <div className="player_separator"></div>
        <div>{enemyPermanents}</div>
        <div id="hud-bottom-spacer" />
        <div id="hud-bottom" className="hud">
          {renderSelection()}
          {renderHand()}
          {chat}
          {renderLog()}
        </div>
      </div>
    );
  },
});

var view = ReactDOM.render(<View />, document.getElementById('view'));

function connectSocket(msg) {
  socket = new WebSocket('wss://' + location.hostname + '/ws/');
  socket.onerror = function(error) {
    console.log("WebSocket error: " + error);
  };
  socket.onopen = function(e) {
    socket.send(JSON.stringify(msg));
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
      gameInfo = msg;
      view.forceUpdate();
    }
    else if (msg.type === 'state') {
      view.updateState({game: msg.state});
    }
    else {
      console.log('Unrecognized WebSocket message type: %s', msg.type);
    }
  };
  socket.onclose = function(e) {
    console.log("WebSocket closed");
  };
}

var bodyEl = document.getElementsByTagName('body').item(0);
bodyEl.onresize = function() {
  view.renderCanvas();

  document.getElementById('hud-spacer').style.height =
    document.getElementById('hud').offsetHeight + 'px';

  document.getElementById('hud-bottom-spacer').style.height =
    document.getElementById('hud-bottom').offsetHeight + 'px';
}

document.onkeypress = function(e) {
  e = e || window.event;

  let chatMessage = document.getElementById('chat_message');

  if (chatMessage === null) {
    return;
  }

  if (document.activeElement !== chatMessage) {
    if (e.key === 'Enter') {
      chatMessage.focus();
    }
    else {
      if (view.keyPress(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }
  else if (e.key === 'Escape') {
    chatMessage.value = '';
    chatMessage.blur();
  }
};
