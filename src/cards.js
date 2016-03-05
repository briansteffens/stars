(function(exports){
  exports.all = function() {
    return [{
      name: 'exploratory drone',
      type: 'ship',
      cost: 1,
      upkeep: 1,
      _draw_chances: 5,
    },{
      name: 'fighter',
      type: 'ship',
      cost: 1,
      upkeep: 1,
      attack: 2,
      defense: 1,
      _draw_chances: 5,
    }];
  };
  exports.explore = function() {
    return [{
      name: 'asteroid',
      type: 'resource',
      worth: 1,
      _draw_chances: 150,
    },{
      name: 'brown dwarf',
      type: 'generator',
      power: 1,
      _draw_chances: 50,
    },{
      name: 'white dwarf',
      type: 'generator',
      power: 2,
      _draw_chances: 20,
    },{
      name: 'blue supergiant',
      type: 'generator',
      power: 10,
    },{
      name: 'yellow dwarf',
      type: 'generator',
      power: 3,
      _draw_chances: 5,
    }];
  };
  exports.mother_ship = function() {
    return {
      name: 'mother ship',
      type: 'ship',
      defense: 20,
    };
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
