

var testReport = require( './alerts' )
  , makeStorage = require( './storage' )
  , makePlugger = require( './plugger' )
  , makeCategorizer = require( './categ' );

// simple api facade
module.exports = function( onAlert, onReport, resolution, confidence ) {

  // defaults
  if( !resolution )
    resolution = 60 * 1000;
  if( !confidence )
    confidence = 0.05;

  // listeners
  if( onReport && typeof onReport !== 'function' )
    throw new Error( "Not a function." );
  if( typeof onAlert !== 'function' )
    throw new Error( "Not a function." );

  // compose
  var store = makeStorage( resolution

    // handle complete reports
  , function( report ) {

      // shoot some alerts
      testReport( report, confidence ).forEach( function( alert ) {
        onAlert( alert );
      });

      // push the report
      if( onReport )
        onReport( report );
    }

    // handle just-saturated single-metric reports
  , function( saturated ) {

      // increase the required confidence level for early alerts
      // to reduce noise from half-baked samples
      testReport( [ saturated ], confidence * 2 ).forEach( function( alert ) {
        onAlert( alert );
      });
    }
  );

  // plugins api
  makePlugger( store );

  // category pushing
  makeCategorizer( store );

  // return the store so we can get make value pushers
  return store;
};

