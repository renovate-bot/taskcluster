/**
 * Return externalBuildUrl or externalBuildSignedUrl, depending on whether the client has credentials
 */
module.exports = client => {
  return (client.credentials ? client.externalBuildSignedUrl : client.externalBuildUrl).bind(client);
};
