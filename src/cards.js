(function(exports){
  exports.all = function() {
    return [{
      name: 'drone',
      type: 'ship',
    },{
      name: 'fighter',
      type: 'ship',
      cost: 1,
      upkeep: 1,
      attack: 2,
      defense: 1,
      _draw_chances: 5,
    },{
      name: 'asteroid',
      type: 'resource',
      worth: 1,
      _draw_chances: 5,
    },{
      name: 'star',
      type: 'generator',
    }];
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);
