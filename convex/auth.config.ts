const authConfig = {
  providers: [
    {
      domain: process.env.WORKOS_ISSUER,
      applicationID: process.env.WORKOS_CLIENT_ID,
    },
  ],
};

export default authConfig;
