
// overrides the http and https packages' request methods
// in order to measure outgoing requests' response times
// categorized by method, protocol, pathname, host and status code.

exports.install = function( stats ) {
  var url = require( 'url' )
    , install = function( protocol ) {
        var module = require( protocol )
          , request = module.request.bind( module )
          , track = stats.make(
              "Outgoing Requests"

              // categories by Host > Protocol, Host > Path, etc.
            , [ "Host" ]
            , [ "Protocol", "Path", "Method", "Status-Code" ]
            );

        module.request = function( opt, callback ) {
          if( typeof opt === 'string' )
            opt = url.parse( opt );

          var time = Date.now()
            , host = opt.host
            , path = opt.pathname
            , method = ( opt.method || 'GET' ).toUpperCase();

          request( opt, function( res ) {
            if( callback )
              callback.apply( null, arguments );

            track(
              Date.now() - time
            , host, protocol, method, path
            , Math.floor( res.statusCode / 100 ) + 'xx'
            );
          });
        };
      };

  install( 'http' );
  install( 'https' );
};

