const { createApp } = require('../dist/app.factory');

let handlerPromise = null;

function getHandler() {
  if (!handlerPromise) {
    handlerPromise = createApp().then(async (app) => {
      await app.init();
      return app.getHttpAdapter().getInstance();
    });
  }
  return handlerPromise;
}

module.exports = async (req, res) => {
  const handler = await getHandler();
  return handler(req, res);
};
