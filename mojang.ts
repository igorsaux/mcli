// Copyright (C) 2026 Igor Spichkin
// SPDX-License-Identifier: Apache-2.0

import * as os from "node:os";

export const VERSIONS_MANIFEST_ENDPOINT =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

export const ASSET_ENDPOINT = `https://resources.download.minecraft.net`;

export type VersionsManifest = {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: VersionManifest[];
};

export type VersionManifest = {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
  complianceLevel: number;
};

export type Rule = {
  action: "allow";
  os?: {
    name?: string;
    arch?: string;
  };
  features?: {
    [feature: string]: boolean;
  };
};

export type GameManifest = {
  arguments: {
    "default-user-jvm": {
      value: string[];
      rules?: Rule[];
    }[];
    game: (
      | string
      | {
          value: string | string[];
          rules?: Rule[];
        }
    )[];
    jvm: (
      | string
      | {
          value: string | string[];
          rules?: Rule[];
        }
    )[];
  };
  assetIndex: {
    id: string;
    sha1: string;
    size: number;
    totalSize: number;
    url: string;
  };
  assets: string;
  complianceLevel: number;
  downloads: {
    client: {
      sha1: string;
      size: number;
      url: string;
    };
    server: {
      sha1: string;
      size: number;
      url: string;
    };
  };
  id: string;
  javaVersion: {
    component: string;
    majorVersion: number;
  };
  libraries: {
    downloads: {
      artifact: {
        path: string;
        sha1: string;
        size: number;
        url: string;
      };
    };
    name: string;
    rules?: Rule[];
  }[];
  mainClass: string;
  minimumLauncherVersion: number;
  releaseTime: string;
  time: string;
  type: string;
};

export type AssetsIndex = {
  objects: {
    [path: string]: {
      hash: string;
      size: number;
    };
  };
};

export function getPlatform(): "windows" | "linux" | "osx" {
  const platform = os.platform();

  if (platform === "darwin") {
    return "osx";
  }

  if (platform === "win32") {
    return "windows";
  }

  return "linux";
}

export function isAllowed(
  rules: Rule[] | null | undefined,
  features: { [feature: string]: boolean },
): boolean {
  if (!rules) {
    return true;
  }

  let allowed = false;

  for (const rule of rules) {
    if (rule.action === "allow" && allowed) {
      continue;
    }

    if (rule.os) {
      if (rule.os.name) {
        allowed = rule.action === "allow" && rule.os.name === getPlatform();
      }

      if (rule.os.arch) {
        allowed = rule.action === "allow" && rule.os.arch === os.arch();
      }
    }

    if (rule.features) {
      for (const feature in rule.features) {
        allowed = rule.action === "allow" && features[feature] === true;
      }
    }
  }

  return allowed;
}
