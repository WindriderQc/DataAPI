/* global use, db */
// MongoDB Playground
// To disable this template go to Settings | MongoDB | Use Default Template For Playground.
// Make sure you are connected to enable completions and to be able to run a playground.
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.
// The result of the last command run in a playground is shown on the results panel.
// By default the first 20 documents will be returned with a cursor.
// Use 'console.log()' to print to the debug output.
// For more documentation on playgrounds please refer to
// https://www.mongodb.com/docs/mongodb-vscode/playgrounds/

use('data');

/*(async () => {
  // Use the exact collection name used by the app (case-sensitive)
  const cursor = db.getCollection('userLogs').find({
    CountryName: { $exists: true, $type: 'string', $regex: /\S/ }
  });

  // toArray() may return a Promise in some shells and a raw array in others.
  // Promise.resolve(...) normalizes both cases so the code below works everywhere.
  const results = await Promise.resolve(cursor.toArray());

  console.log(`Found ${results.length} documents`);
  return results.slice(0, 50); // return these so the playground displays them
})();*/

use('data');

// Example: merge all documents from `userLogs` into `mySessions` in the same server
db.getCollection('userLogs').aggregate([
  { $match: {} },
  { $merge: { into: { db: 'data', coll: 'mySessions' }, on: '_id', whenMatched: 'keepExisting', whenNotMatched: 'insert' } }
], { allowDiskUse: true });