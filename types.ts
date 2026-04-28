export type Manifest = {
  minecraft: {
    version: string;
    mainClass?: string;
    libraries?: string[];
    args?: {
      username?: string;
      uuid?: string;
      accessToken?: string;
      xuid?: string;
    };
  };
};
