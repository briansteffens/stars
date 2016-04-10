var game_info = undefined;
var socket = undefined;
var body_el = document.getElementsByTagName('body').item(0);

var Menu = React.createClass({
  getInitialState: function() {
    return {};
  },
  swap: function(target) {
    this.props.menu(target);
  },
  render: function() {
    return (
      <span>
        <input type="button" value="lobby"
          onClick={this.swap.bind(null, 'lobby')} />
        <input type="button" value="game"
          onClick={this.swap.bind(null, 'game')} />
      </span>
    );
  },
});

var Chat = React.createClass({
  getInitialState: function() {
    return {
      chats: []
    };
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
    this.setState({
      chats: [msg, ...this.state.chats],
    });
    window.requestAnimationFrame(function() {
      let messages = document.getElementById("messages");
      messages.scrollTop = messages.scrollHeight;
    });
  },
  render: function() {
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

    return (
      <div className="chat_container">
        <div className="chat">
          <div id="messages" className="messages">
            {chats}
          </div>
          <form onSubmit={this.send}>
            <button className="submit">send</button>
            <span>
              <input id="chat_message" type="text"
                placeholder="enter a message" ref="message" />
            </span>
          </form>
        </div>
      </div>
    );
  },
});

var Lobby = React.createClass({
  page_type: 'lobby',
  getInitialState: function() {
    return {};
  },
  render: function() {
    return (
      <div>
        <div id="hud-bottom" className="hud">
          {this.props.children}
        </div>
      </div>
    );
  },
});

var Game = React.createClass({
  page_type: 'game',
  getInitialState: function() {
    return {
      game: null,
      source: null,
      action: null,
      selection: null,
    };
  },
  get_permanent: function(copy_id) {
    for (let player_id of Object.keys(this.state.game.players)) {
      for (let perm of this.state.game.players[player_id].permanents) {
        if (perm.copy_id == copy_id) {
          return perm;
        }
      }
    }
    throw 'Permanent ' + copy_id + ' not found';
  },
  set_state: function(game_state) {
    this.update_state({game: game_state});
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
      this.target_start(card, card.actions[0], e);
    } else {
      socket.send(JSON.stringify({type: 'play',copy_id: card.copy_id}));
    }
  },
  update_state: function(fields) {
    let new_state = {};

    for (let field of ['game','action','source','selection']) {
      if (fields[field] !== undefined) {
        new_state[field] = fields[field];
      } else {
        try {
          new_state[field] = clone(this.state[field]);
        } catch (e) {
          new_state[field] = this.state[field];
        }
      }
    }

    this.setState(new_state);

    body_el.onresize();

    window.requestAnimationFrame(function() {
      let log = document.getElementById("log");
      log.scrollTop = log.scrollHeight;
    });
  },
  select: function(card, e) {
    this.update_state({
      selection: card.copy_id,
    });
  },
  target_start: function(source, action, e) {
    this.update_state({
      action: action,
      source: source,
    });
  },
  target_cancel: function(e) {
    this.update_state({
      action: null,
      source: null,
    });
  },
  target_finish: function(target, e) {
    socket.send(JSON.stringify({
      type: 'action',
      source: this.state.source.copy_id,
      action: this.state.action.name,
      target: target.copy_id,
    }));
    this.target_cancel(e);
  },
  toggle_power: function(card, e) {
    socket.send(JSON.stringify({
      type: 'toggle_power',
      card: card.copy_id,
    }));
  },
  scrap: function(card, e) {
    socket.send(JSON.stringify({
      type: 'scrap',
      card: card.copy_id,
    }));
  },
  shields: function(card, delta, e) {
    socket.send(JSON.stringify({
      type: 'shields',
      card: card.copy_id,
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
  get_action: function(card, action_name) {
    for (let action of card.actions) {
      if (action.name === action_name) {
        return action;
      }
    }
    return null;
  },
  key_press: function(e) {
    if (e.key === 'Escape') {
      this.update_state({
        action: null,
        source: null,
      });
      return true;
    }
    if (e.key === 'Tab') {
      if (this.state.selection === null) {
        let new_selection = this.get_me().permanents[0] ||
          this.get_enemy().permanents[0];
        if (new_selection !== undefined) {
          this.update_state({selection: new_selection.copy_id});
        }
        return true;
      }

      let sel_info = this.get_card_info(this.state.selection);
      let container = sel_info.container;
      let index = container.indexOf(sel_info.card) + 1;

      if (index >= container.length) {
        index = 0;

        if (sel_info.is_mine) {
          container = this.get_enemy().permanents;
        } else {
          container = this.get_me().permanents;
        }
      }

      this.update_state({selection: container[index].copy_id});
      return true;
    }
    if (this.state.selection !== null) {
      let card_info = this.get_card_info(this.state.selection);
      if (card_info.is_perm) {
        if (e.key.toLowerCase() === 't') {
          if (this.is_targeting(card_info)) {
            this.target_finish(card_info.card);
          }
          return true;
        }
        if (card_info.is_mine) {
          if (e.key.toLowerCase() === 'a') {
            let action = this.get_action(card_info.card, 'attack');
            if (action !== null) {
              this.target_start(card_info.card, action);
            }
          }
        } else {
        }
      }
    }
    return false;
  },
  get_card_info: function(copy_id) {
    let me = this.get_me();
    for (let owner of [me, this.get_enemy()]) {
      for (let container_name of ['permanents', 'hand']) {
        for (let test of owner[container_name]) {
          if (test.copy_id == this.state.selection) {
            return {
              card: test,
              is_mine: owner === me,
              is_perm: container_name === 'permanents',
              container_name: container_name,
              container: owner[container_name],
            };
          }
        }
      }
    }
    return null;
  },
  get_me: function() {
    return this.state.game.players[game_info.user_id];
  },
  get_enemy: function() {
    for (let key in this.state.game.players) {
      if (this.state.game.players.hasOwnProperty(key) &&
          key != game_info.user_id) {
        return this.state.game.players[key];
      }
    }
    throw 'enemy not found';
  },
  is_my_turn: function() {
    return this.state.game.turn_player_id == game_info.user_id;
  },
  is_targeting: function(card_info) {
    if (!card_info.is_perm || !this.is_my_turn() ||
        this.state.action === null) {
      return false;
    }

    let targets = this.state.action.targeting;

    let ownership_match = false;
    if (targets.contains('friendly')) {
      ownership_match = card_info.is_mine;
    } else if (targets.contains('enemy')) {
      ownership_match = !card_info.is_mine;
    }

    return ownership_match &&
      targets.intersect(card_info.card.types).length > 0;
  },
  render: function() {
    var game = this.state.game;

    if (game_info === undefined || game === null) {
      return (<i>Connecting..</i>);
    }

    var that = this;
    var me = this.get_me();
    var enemy = this.get_enemy();
    var my_turn = this.is_my_turn();

    let render_card = function(card, is_mine, is_perm) {
      let cls = 'card';
      if (that.state.selection && that.state.selection == card.copy_id) {
        cls += ' sel';
      }

      return (
        <img id={'perm_' + card.copy_id} key={card.copy_id}
          src={'/img/' + card.image} className={cls}
          onClick={that.select.bind(that, card)} />
      );
    };

    let render_permanents = function(perms, are_mine) {
      let ret = [];

      for (let perm of perms) {
        if (perm.name === 'mother ship') {
          ret.push(render_card(perm, are_mine, true));
        }
      }

      for (let perm of perms) {
        if (perm.name !== 'mother ship' && perm.types.contains('generator')) {
          ret.push(render_card(perm, are_mine, true));
        }
      }

      for (let perm of perms) {
        if (perm.name !== 'mother ship' && !perm.types.contains('generator')) {
          ret.push(render_card(perm, are_mine, true));
        }
      }

      return ret;
    };

    let permanents = render_permanents(me.permanents, true);
    let enemy_permanents = render_permanents(enemy.permanents);

    let gameover = '';
    if (game.winner !== undefined) {
      let outcome = game.winner == game_info.user_id ? 'won' : 'lost';
      gameover = (<h3>Game over! You {outcome}!</h3>);
    }

    let render_power = function(player) {
      return (
        <span className="power">
          {player.power_total - player.power_used}/{player.power_total}
        </span>
      );
    };

    let render_shields = function(player) {
      return (<span className="shields">
          {player.shields_used}/{player.shields_total}</span>);
    }

    let pregame = '';
    if (game.phase === 'pre-game') {
      let enemy_ready = '';
      if (enemy.ready) {
        enemy_ready = (<span>the other player is ready</span>);
      }
      pregame = (
        <span>
          <input type="button" onClick={this.mull} value="mull"
            disabled={me.ready} />
          <input type="button" onClick={this.ready} value="ready"
            disabled={me.ready} />
          {enemy_ready}
        </span>
      );
    }

    let cancel_target_button = '';
    if (this.state.action !== null) {
      cancel_target_button = (
        <input type="button" onClick={this.target_cancel}
          value="cancel action" />
      );
    }

    let hud = '';
    if (pregame !== '') {
      hud = (<div id="hud" className="hud">{pregame}</div>);
    } else {
      let defend = '';
      if (my_turn && game.phase === 'defend') {
        defend = (
          <input type="button" onClick={this.defend} value="defend"
            disabled={!my_turn || game.phase !== 'defend'} />
        );
      }

      hud = (
        <div id="hud" className="hud">
          {this.props.children[0]}
          {pregame}
          {gameover}
          It is <strong>{my_turn ? '' : 'not '}your turn</strong>.
          Phase: <strong>{game.phase}</strong>
          {defend}
          <input type="button" onClick={this.yield} value="yield"
            disabled={!my_turn || game.phase !== 'main'} />
          <input type="button" onClick={this.forfeit} value="forfeit"
            disabled={game.winner !== undefined} />
          {cancel_target_button}
          <div className="stats">
            &nbsp;
            Scrap: {me.scrap}
            &nbsp;
            Power: {render_power(me)}
            &nbsp;
            Shields: {render_shields(me)}
          </div>
        </div>
      );
    }

    let render_selection = function() {
      if (!that.state.selection) {
        return (<div />);
      }

      let card_info = that.get_card_info(that.state.selection);
      if (card_info === null) {
        console.log('Cannot find card container');
        return (<div />);
      }

      let card = card_info.card;
      let is_mine = card_info.is_mine;
      let is_perm = card_info.is_perm;

      let actions = [];
      let target = '';
      let power = '';
      let play = '';
      let shields = '';
      let effects = '';
      let mass = '';

      if (is_perm) {
        // Target button
        if (that.is_targeting(card_info)) {
          target = (<input type="button" value="target"
              onClick={that.target_finish.bind(null, card)} />);
        }

        // Action buttons
        if (is_mine) {
          for (let i = 0; i < card.actions.length; i++) {
            let action = card.actions[i];
            let can_attack = is_perm && my_turn && that.state.action === null
                && !card.tapped;
            if (!card.types.contains('black_hole')) {
              can_attack = can_attack && card.powered;
            }
            actions.push(
              <input type="button" value={action.name} key={action.name}
                onClick={that.target_start.bind(null, card, action)}
                disabled={!can_attack} />
            );
          }
        }

        // Power button
        if (is_mine && card.upkeep !== undefined) {
          let can_power = card.powered ||
                          me.power_used + card.upkeep <= me.power_total;

          power = (
            <input type="button"
              value={card.powered ? "power off" : "power on"}
              disabled={card.tapped || !can_power}
              onClick={that.toggle_power.bind(null, card)} />
          );
        }

        // Shields
        if (card.shields !== undefined &&
            card.types.intersect(['generator','black_hole']).length == 0) {
          shields = (<span>shields: {card.shields}</span>);

          if (is_mine) {
            shields = (
              <div className="shields">
                <input type="button" value="-"
                    onClick={that.shields.bind(null, card, -1)}
                    disabled={!my_turn || card.shields <= 0} />
                {shields}
                <input type="button" value="+"
                    onClick={that.shields.bind(null, card, 1)}
                    disabled={!my_turn ||
                              me.shields_total - me.shields_used <= 0 ||
                              me.power_total - me.power_used <= 0} />
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

      let or_zero = function(v) { return v !== undefined ? v : 0 };

      let stats = '';
      if (card.types.contains('ship')) {
        stats = or_zero(card.attack) + '/' + or_zero(card.hp);
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

      let scrap = '';
      if (is_mine && (card.types.intersect(['ship','instant']).length > 0) &&
          card.name !== 'mother ship') {
        scrap = (<input type="button" value="scrap" disabled={!my_turn}
            onClick={that.scrap.bind(null, card)} />);
      }

      return (
        <div>
          {target}
          <div className="title">{card.name+" "}</div>
          {effects}
          {generates}
          <div>{stats}</div>
          {mass}
          {power}
          {scrap}
          {play}
          {shields}
          {actions}
          {upkeep}
          {cost}
          {worth}
        </div>
      );
    }

    let render_hand = function() {
      let hand = [];

      for (let card of me.hand) {
        let scrap = '';
        if (card.types.intersect(['ship','instant']).length > 0) {
          scrap = (<button onClick={that.scrap.bind(null, card)}
            disabled={!my_turn}>scrap</button>);
        }

        hand.push(
          <div key={card.copy_id}>
            {card.name}
            <button onClick={that.play.bind(that, card)} disabled={!my_turn}>
              play</button>
            {scrap}
          </div>
        );
      }

      let draw_possible = my_turn ? game.draw_possible : 0;
      let explore_possible = my_turn ? game.can_explore : 0;

      return (
        <div id="hand">
          <input type="button" onClick={that.draw}
            value={'draw (' + draw_possible + ')'}
            disabled={!draw_possible} />
          <input type="button" onClick={that.explore}
            value={'explore (' + explore_possible + ')'}
            disabled={!explore_possible} />
          <div id="cards">{hand}</div>
        </div>
      );
    }

    let render_log = function() {
      let log = [];
      for (let index = 0; index < game.log.length; index++) {
        let entry = game.log[index];
        log.push(<div key={index}>{entry.message}</div>);
      }

      return (<div id="log">{log}</div>);
    }

    return (
      <div>
        {hud}
        <div id="hud-spacer" />
        <div>{permanents}</div>
        <div className="player_separator"></div>
        <div>{enemy_permanents}</div>
        <div id="hud-bottom-spacer" />
        <div id="hud-bottom" className="hud">
          {render_selection()}
          {render_hand()}
          {this.props.children[1]}
          {render_log()}
        </div>
      </div>
    );
  },
  render_canvas: function() {
    var canvas = document.getElementById('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    if (this.state.game === null) {
      return;
    }

    let game = this.state.game;

    ctx.strokeStyle = 'rgb(200, 0, 0)';
    ctx.lineWidth = 2;

    var draw_attack_line = function(top_el, bottom_el) {
      ctx.beginPath();
      ctx.moveTo(top_el.offsetLeft + top_el.offsetWidth / 2,
                 top_el.offsetTop + top_el.offsetHeight);
      ctx.lineTo(bottom_el.offsetLeft + bottom_el.offsetWidth / 2,
                 bottom_el.offsetTop);
      ctx.stroke();
    };

    var my_turn = game.turn_player_id == game_info.user_id;

    for (let attack of game.attacks) {
      let attacker_el = document.getElementById('perm_'+attack.attacker);
      let target_el = document.getElementById('perm_'+attack.target);

      if (my_turn && game.phase === 'main' ||
          !my_turn && game.phase === 'defend') {
        draw_attack_line(attacker_el, target_el);
      } else {
        draw_attack_line(target_el, attacker_el);
      }
    }
  },
});

var states = {
  lobby: null,
  game: null,
  chat: null,
};

var view_just_changed = true;

var View = React.createClass({
  getInitialState: function() {
    return {last_page: 'lobby', page: 'lobby'};
  },
  menu: function(page) {
    view_just_changed = true;
    this.setState({last_page: this.state.page, page: page});
  },
  render: function() {
    let children = [
      (<Menu ref="menu" key="menu" menu={this.menu} />),
      (<Chat ref="chat" key="chat" />),
    ];

    if (view_just_changed) {
      if (this.refs.page !== undefined) {
        states[this.refs.page.page_type] = this.refs.page.state;
        states['chat'] = this.refs.chat.state;
      }
      console.log(states);
    }

    if (this.state.page === 'lobby') {
      return (<Lobby ref="page">{children}</Lobby>);
    } else if (this.state.page === 'game') {
      return (<Game ref="page">{children}</Game>);
    }
  },
  componentDidUpdate: function() {
    if (view_just_changed) {
      if (states[this.state.page] !== null) {
        this.refs.page.setState(JSON.parse(JSON.stringify(
                states[this.state.page])));
      }

      if (states.chat !== null) {
        //this.refs.chat.setState(states.chat);
      }

      if (this.state.page === 'game') {
        connect_socket({
          type: 'connect',
          page: 'game',
          token: game_socket_token,
        });
      }

      view_just_changed = false;
    }
  },
});

var view = ReactDOM.render(<View />, document.getElementById('view'));

function connect_socket(msg) {
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
      view.refs.chat.add(msg.chat);
    }
    else if (msg.type === 'chats') {
      for (var i = msg.chats.length - 1; i >= 0; i--) {
        view.refs.chat.add(msg.chats[i]);
      }
    }
    else if (msg.type === 'greetings') {
      game_info = msg;
      view.forceUpdate();
    }
    else if (msg.type === 'state') {
      view.refs.page.set_state(msg.state);
    }
    else {
      console.log('Unrecognized WebSocket message type: %s', msg.type);
    }
  };
  socket.onclose = function(e) {
    console.log("WebSocket closed");
  };
}

body_el.onresize = function() {
  if (view.refs.page.page_type !== 'game') {
    return;
  }

  view.refs.page.render_canvas();

  document.getElementById('hud-spacer').style.height =
    document.getElementById('hud').offsetHeight + 'px';

  document.getElementById('hud-bottom-spacer').style.height =
    document.getElementById('hud-bottom').offsetHeight + 'px';
}

document.onkeypress = function(e) {
  e = e || window.event;

  let chat_message = document.getElementById('chat_message');

  if (chat_message === null) {
    return;
  }

  if (document.activeElement !== chat_message) {
    if (e.key === 'Enter') {
      chat_message.focus();
    }
    else {
      if (view.key_press(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }
  else if (e.key === 'Escape') {
    chat_message.value = '';
    chat_message.blur();
  }
};
