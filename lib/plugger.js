
var plug = function() {
  var i, n = arguments.length
    , plugin;

  for( i = 0; i < n; i ++ ) {
    plugin = arguments[ i ];
    if( !plugin )
      continue;

    // plugins by name
    if( typeof plugin === 'string' ) {

      // try to load a built-in
      try {
        plugin = require( '../plugins/' + plugin );
      }
      catch( o_O ) {}

      // try to load a peer
      if( !plugin )
        plugin = require( 'instat-' + plugin );
    }

    // function plugins
    if( typeof plugin === 'function' )
      plugin( this );

    // object plugins
    else if( !plugin || typeof plugin.install !== 'function' )
      throw new Error( "Bad plugin: " + plugin );
    else
      plugin.install( this );
  }

  return this;
};

module.exports = function( pluginHost ) {
  pluginHost.plug = plug.bind( pluginHost );
};
