export type Manifest = {
  minecraft: {
    version: string;
    args?: {
      username?: string;
      uuid?: string;
      accessToken?: string;
      clientId?: string;
      xuid?: string;
    };
  };
};
