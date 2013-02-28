/*global console:false, process:false*/

var assert = require( 'assert' );


//
function validate( time, alerts, report, count ) {
  var util = require( 'util' )
    , inspect = function( obj ) {
        return util.inspect( obj, false, 10, true );
      };

  console.log( "DURATION:", time );
  console.log( "COUNT:", count );
  console.log( "REPORT:", inspect( report ) );
  console.log( "ALERTS:", inspect( alerts ) );

  // sample sizes
  var total = report.current.n;
  report.history.forEach( function( bucket ) {
    total += bucket.n;
  });

  assert( !( total > count ), "We're synthesizing observations: " + ( total - count ) );
  assert( !( total < count ), "We're losing observations: " + ( count - total ) );
  assert( total === count );

  // stddev(uniform(0,1)) is 1/sqrt(12) ~ 0.2887
  // the last window should have a lesser stddev since it hasn't slid so much
  // also i'm putting some margins here coz stuff is random
  assert( report.current.dev < report.history[ 0 ].dev + 0.05, "Rolling stddev looks bad." );
  assert( report.current.dev > 0.2, "Stddev doesn't look right." );
  assert( report.history[ 0 ].dev < 0.5, "Stddev doesn't look right." );

  // we should get an alert about the rising average and/or rising upper range limit
  assert( alerts.length, "No alerts generated." );

  var maxL = 0, avgL = 0, maxX = 0, avgX = 0;

  alerts.forEach( function( alert ) {
    assert( alert.alpha > 0.05, "Alpha is off." );
    maxL = Math.max( maxL, alert.delta.maxL || 0 );
    avgL = Math.max( avgL, alert.delta.avgL || 0 );
    maxX = Math.max( maxX, alert.delta.maxX || 0 );
    avgX = Math.max( avgX, alert.delta.avgX || 0 );
  });

  assert( maxL > 0.1, "maxL was underrepored." );
  assert( avgL > 0.1, "avgL was underrepored." );
  assert( maxX > 0.05, "maxX was underrepored." );
  assert( avgX > 0.05, "avgX was underrepored." );

  console.log( "\nAll good." );
}


//
var WINDOW = 250
  , THRESH = 10.25 // entering the eight bucket means we do second gen compaction
  , START = Date.now()

  , alerts = []
  , metrics = require( './lib/index' )( function( data ) {
      assert( data, "Alert data is falsy." );
      alerts.push( data );
    }, null, WINDOW )

  , pushObservation = metrics.make( 'key' )
  , count = 0

  , next = function() {
      var now = Date.now()
        , stable = ( now - START ) / WINDOW
        , rand = Math.random();

      if( stable > THRESH ) {
        validate( now - START, alerts, metrics.getReport().pop(), count );
        return process.exit();
      }

      count ++;
      pushObservation( stable / 50 + rand );
      process.nextTick( next );
    };

process.nextTick( next );

