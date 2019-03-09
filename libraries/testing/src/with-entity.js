const {sasCredentials} = require('taskcluster-lib-azure');
const slugid = require('slugid');

// a suffix used to generate unique table names so that parallel test runs do not
// interfere with one another.  We remove these at the end of the test run.
const TABLE_SUFFIX = slugid.nice().replace(/[_-]/g, '');

// withEntity: monkey-patch an entity class to either use inmemory data
// or to use a unique table name, and set up to ensure the table exists and
// is empty at startup, and when the test completes.
module.exports = (mock, skipping, helper, loaderComponent, cls,
  {orderedTests, cleanup, noSasCredentials}={}) => {
  let component;

  // on suite setup, monkey-patch the `setup` method of each class to do what
  // we promise; then un-patch it on teardown
  suiteSetup(`withEntity for ${loaderComponent}`, async function() {
    if (skipping()) {
      return;
    }

    const cfg = await helper.load('cfg');
    oldSetup = cls.setup;
    cls.setup = function ({...options}) {
      if (mock) {
        options.credentials = 'inMemory';
      } else {
        options.tableName = options.tableName + TABLE_SUFFIX;
        // since the tableName has changed, we need new creds
        if (!noSasCredentials) {
          options.credentials = sasCredentials({
            accountId: cfg.azure.accountId,
            tableName: options.tableName,
            rootUrl: cfg.taskcluster.rootUrl,
            credentials: cfg.taskcluster.credentials,
          });
        }
      }

      // un-monkeypatch
      cls.setup = oldSetup;
      return this.setup(options);
    };

    // now invoke the loader component to load this class
    component = await helper.load(loaderComponent);
    helper[loaderComponent] = component;

    // ensure the table exists (except when using SAS, where it is done for us)
    if (mock || !noSasCredentials) {
      await component.ensureTable();
    }
  });

  // the default cleanup operation is just to delete all rows
  if (!cleanup) {
    cleanup = async () => {
      if (!skipping() && component) {
        await component.scan({}, {handler: e => e.remove()});
      }
    };
  }

  // if tests are not ordered, empty the table before each test, and for
  // completeness after the suite; otherwise empty before the suite but
  // not between tests
  if (orderedTests) {
    suiteSetup(`withEntity for ${loaderComponent}`, cleanup);
  } else {
    setup(`withEntity for ${loaderComponent}`, cleanup);
  }

  suiteTeardown(`withEntity for ${loaderComponent}`, function() {
    if (skipping()) {
      return;
    }
    cleanup();

    component = helper[loaderComponent] = null;
  });
};
