const containers = require('../src/containers');
const assert = require('assert');
const helper = require('./helper');
const testing = require('taskcluster-lib-testing');

const sorted = (arr) => {
  arr.sort();
  return arr;
};

helper.secrets.mockSuite(testing.suiteName(), ['db', 'azure', 'gcp'], function(mock, skipping) {
  helper.withDb(mock, skipping);
  helper.withCfg(mock, skipping);
  helper.withPulse(mock, skipping);
  helper.withEntities(mock, skipping);
  helper.withServers(mock, skipping);
  helper.resetTables(mock, skipping);

  const containerName = helper.containerName;
  let credentials;

  test('get when blob is empty', async function() {
    assert.deepEqual(await helper.Roles.get(), []);
  });

  test('first modification of an empty blob', async function() {
    await helper.Roles.modifyRole(({ blob: roles }) => {
      roles.push({
        roleId: 'my-role',
        scopes: ['a', 'b'],
        description: 'a role!',
        created: new Date('2017-01-01').toJSON(),
        lastModified: new Date('2017-01-01').toJSON(),
      });
    });

    assert.deepEqual(sorted((await helper.Roles.get()).map(r => r.roleId)),
      sorted(['my-role']));
  });

  test('add a second role', async function() {
    await helper.Roles.modifyRole(({ blob: roles }) => {
      roles.push({
        roleId: 'my-role',
        scopes: ['a', 'b'],
        description: 'a role!',
        created: new Date('2017-01-01').toJSON(),
        lastModified: new Date('2017-01-01').toJSON(),
      });
    });
    await helper.Roles.modifyRole(({ blob: roles }) => {
      roles.push({
        roleId: 'second-role',
        scopes: ['x', 'y'],
        description: 'a role!',
        created: new Date('2017-01-02').toJSON(),
        lastModified: new Date('2017-01-02').toJSON(),
      });
    });
    assert.deepEqual(sorted((await helper.Roles.get()).map(r => r.roleId)),
      sorted(['my-role', 'second-role']));
  });

  // no longer relevant now that roles is a postgres table
  // rather than an azure blob
  test.skip('create a second DataContainer', async function() {
    // this verifies that creating a container doesn't erase the roles!
    const roles2 = new containers.Roles({
      containerName,
      credentials,
    });
    await roles2.setup();

    assert.deepEqual(sorted((await roles2.get()).map(r => r.roleId)),
      sorted(['my-role', 'second-role']));
  });
});
