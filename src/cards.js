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
    },{
      name: 'asteroid',
      type: 'resource',
    },{
      name: 'star',
      type: 'generator',
    }];
  };
})(typeof exports === 'undefined' ? this['state'] = {} : exports);