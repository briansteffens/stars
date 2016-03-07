(function(exports){
  exports.fill_in = function(cards) {
    for (var i = 0; i < cards.length; i++) {
      card = cards[i];

      if (typeof card.actions === 'undefined') {
        card.actions = [];
      }

      if (typeof card.attack !== 'undefined') {
        var found = false;
        for (var j = 0; j < card.actions.length; j++) {
          if (card.actions[j].name === 'attack') {
            found = true;
            break;
          }
        }
        if (!found) {
          card.actions.push({
            name: 'attack',
            targeting: 'enemy',
          });
        }
      }

      if (typeof card.defense !== 'undefined') {
        card.hp = card.defense;
      }
    }

    return cards;
  };

  exports.all = function() {
    return exports.fill_in([{
      name: 'exploratory drone',
      type: 'ship',
      cost: 1,
      upkeep: 1,
      defense: 2,
      _draw_chances: 7,
    },{
      name: 'fighter',
      type: 'ship',
      cost: 2,
      upkeep: 2,
      attack: 1,
      defense: 2,
      _draw_chances: 8,
    },{
      name: 'bomber',
      type: 'ship',
      cost: 4,
      upkeep: 3,
      attack: 3,
      defense: 2,
      _draw_chances: 8,
    },{
      name: 'glass cannon',
      type: 'ship',
      cost: 5,
      upkeep: 5,
      attack: 5,
      defense: 0,
      _draw_chances: 1,
    },{
      name: 'laser turret',
      type: 'ship',
      cost: 2,
      upkeep: 2,
      attack: 1,
      defense: 3,
      _draw_chances: 4,
    },{
      name: 'reactor',
      type: 'generator',
      power: 1,
      _draw_chances: 15,
    },{
      name: 'scrap',
      type: 'resource',
      worth: 1,
      _draw_chances: 19,
    },{
      name: 'repair crew',
      type: 'instant',
      actions: [
        {
          name: 'repair',
          targeting: 'friendly',
          amount: 2,
        },
      ],
      _draw_chances: 7,
    },{
      name: 'repair bot',
      type: 'ship',
      upkeep: 1,
      actions: [
        {
          name: 'repair',
          targeting: 'friendly',
          amount: 3,
        },
      ],
      _draw_chances: 5,
    }]);
  };

  exports.explore = function() {
    return exports.fill_in([{
      name: 'asteroid',
      type: 'resource',
      worth: 2,
      _draw_chances: 150,
    },{
      name: 'rocky planet',
      type: 'resource',
      worth: 8,
      _draw_chances: 40,
    },{
      name: 'ship wreckage',
      type: 'resource',
      worth: 3,
      _draw_chances: 80,
    },{
      name: 'brown dwarf',
      type: 'generator',
      power: 4,
      _draw_chances: 50,
    },{
      name: 'white dwarf',
      type: 'generator',
      power: 6,
      _draw_chances: 35,
    },{
      name: 'blue supergiant',
      type: 'generator',
      power: 10,
      _draw_chances: 1,
    },{
      name: 'yellow dwarf',
      type: 'generator',
      power: 8,
      _draw_chances: 15,
    }]);
  };

  exports.mother_ship = function() {
    return exports.fill_in([{
      name: 'mother ship',
      type: 'ship',
      defense: 20,
    }])[0];
  };

  exports.pool = function(cards) {
    var ret = [];
    for (var i = 0; i < cards.length; i++) {
      var chance = typeof cards[i]._draw_chances === 'undefined' ?
                   1 : cards[i]._draw_chances;

      for (var j = 0; j < chance; j++) {
        ret.push(cards[i]);
      }
    }
    return ret;
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
