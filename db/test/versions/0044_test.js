const assert = require('assert').strict;
const _ = require('lodash');
const helper = require('../helper');
const testing = require('taskcluster-lib-testing');
const Entity = require('taskcluster-lib-entities');

const THIS_VERSION = parseInt(/.*\/0*(\d+)_test\.js/.exec(__filename)[1]);
const PREV_VERSION = THIS_VERSION - 1;

// (adapted from services/queue/src/data.js)
const QueueWorkerTypeEntities = Entity.configure({
  version: 1,
  partitionKey: Entity.keys.StringKey('provisionerId'),
  rowKey: Entity.keys.StringKey('workerType'),
  properties: {
    provisionerId: Entity.types.String,
    workerType: Entity.types.String,
    // the time at which this worker-type should no longer be displayed
    expires: Entity.types.Date,
    lastDateActive: Entity.types.Date,
    description: Entity.types.Text,
    stability: Entity.types.String,
  },
});

suite(testing.suiteName(), function() {
  helper.withDbForVersion();

  test('queue_worker_types table created / removed on upgrade and downgrade', async function() {
    await testing.resetDb({testDbUrl: helper.dbUrl});
    await helper.upgradeTo(PREV_VERSION);

    await helper.assertTable('queue_worker_type_entities');
    await helper.assertNoTable('queue_worker_types');

    await helper.upgradeTo(THIS_VERSION);
    await helper.assertTable('queue_worker_types');
    await helper.assertNoTable('queue_worker_type_entities');

    await helper.downgradeTo(PREV_VERSION);
    await helper.assertTable('queue_worker_type_entities');
    await helper.assertNoTable('queue_worker_types');
  });

  helper.testEntityTable({
    dbVersion: THIS_VERSION,
    serviceName: 'queue',
    entityTableName: 'queue_worker_type_entities',
    newTableName: 'queue_worker_types',
    EntityClass: QueueWorkerTypeEntities,
    samples: {
      aabbccddeeff: {
        provisionerId: 'aaa/provisioner',
        workerType: 'aaa/workertype',
        expires: new Date(1),
        lastDateActive: new Date(2),
        description: 'aaa/description',
        stability: 'aaa/stability',
      },
      ...Object.fromEntries(_.range(5).map(i => ([
        `samp${i}`, {
          provisionerId: `some/provisioner${i}`,
          workerType: `some/workertype${i}`,
          expires: new Date(1),
          lastDateActive: new Date(2),
          description: `some/description${i}`,
          stability: `some/stability${i}`,
        }]))),
    },
    loadConditions: [
      {condition: {provisionerId: 'aaa/provisioner', workerType: 'aaa/workertype'}, expectedSample: 'aabbccddeeff'},
      {condition: {provisionerId: 'some/provisioner1', workerType: 'some/workertype1'}, expectedSample: 'samp1'},
    ],
    scanConditions: [
      {condition: {}, expectedSamples: ['aabbccddeeff', 'samp0', 'samp1', 'samp2', 'samp3', 'samp4']},
      {condition: null, expectedSamples: ['aabbccddeeff', 'samp0', 'samp1', 'samp2', 'samp3', 'samp4']},
    ],
    notFoundConditions: [
      {condition: {provisionerId: 'no/such', workerType: 'no/such'}},
    ],
    notImplemented: ['create-overwrite'],
    modifications: [{
      condition: {provisionerId: 'aaa/provisioner', workerType: 'aaa/workertype'},
      modifier: [
        ent => {
          ent.expires = new Date(3);
        },
      ],
      checker(ent) {
        assert.deepEqual(ent.expires, new Date(3));
      },
    }],
  });
});
