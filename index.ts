#!/usr/bin/env bun
// Copyright (C) 2026 Igor Spichkin
// SPDX-License-Identifier: Apache-2.0

import * as os from "node:os";
import * as process from "node:process";
import * as path from "node:path";
import * as constants from "./constants.ts";
import Cache from "./cache.ts";
import * as mojang from "./mojang.ts";
import * as types from "./types.ts";
import * as utils from "./utils";
import * as bun from "bun";

async function tryFetchVersionManifest(
  requiredVersion: string,
  cache: Cache,
): Promise<{
  versions: mojang.VersionsManifest;
  resolved: mojang.VersionManifest | null;
} | null> {
  let versionsManifestFile = await cache.fetch(
    constants.VERSIONS_MANIFEST_FILE,
    null,
  );

  if (await versionsManifestFile?.exists()) {
    const content =
      (await versionsManifestFile?.json()) as mojang.VersionsManifest;

    if (content?.versions?.length > 0) {
      const resolved = content.versions.find((v) => v.id === requiredVersion);

      if (resolved) {
        return { resolved, versions: content };
      }
    }
  }

  let raw: string = null!;

  try {
    console.debug(
      `Fetching the versions manifest from '${mojang.VERSIONS_MANIFEST_ENDPOINT}'`,
    );

    const response = await fetch(mojang.VERSIONS_MANIFEST_ENDPOINT, {
      signal: AbortSignal.timeout(constants.DEFAULT_TIMEOUT),
    });

    if (response.body === null) {
      console.error(
        `Response from '${mojang.VERSIONS_MANIFEST_ENDPOINT}' returned null`,
      );

      return null;
    }

    raw = await response.text();
  } catch (err) {
    console.error(
      `Failed to fetch the version manifest from '${mojang.VERSIONS_MANIFEST_ENDPOINT}': ${err}`,
    );

    return null;
  }

  await cache.save(constants.VERSIONS_MANIFEST_FILE, raw);

  const content = JSON.parse(raw) as mojang.VersionsManifest;
  const resolved =
    content.versions.find((v) => v.id === requiredVersion) || null;

  return { resolved, versions: content };
}

async function tryFetchGameManifest(
  versionManifest: mojang.VersionManifest,
  cache: Cache,
): Promise<mojang.GameManifest | null> {
  const cachePath = `versions/${versionManifest.sha1}`;
  let file = await cache.fetch(cachePath, versionManifest.sha1);

  if (file) {
    return await file.json();
  }

  console.debug(`Fetching the game manifest from '${versionManifest.url}'`);

  try {
    const response = await fetch(versionManifest.url);

    if (response.body === null) {
      console.error(`Response from '${versionManifest.url}' returned null`);

      return null;
    }

    const raw = await response.text();
    await cache.save(cachePath, raw);

    return JSON.parse(raw);
  } catch (err) {
    console.error(
      `Failed to fetch the game manifest from '${versionManifest.url}': ${err}`,
    );

    return null;
  }
}

function printHelp() {
  console.log("Usage: mcli <command> [...args]\n");
  console.log("Commands:");
  console.log("init\t\tPrepare the current folder for a Minecraft");
  console.log("sync\t\tSetups the Minecraft in the current folder");
  console.log("run\t\tRuns the Minecraft in the current folder");
}

async function tryGetManifest(): Promise<types.Manifest | null> {
  const manifest = Bun.file(`./${constants.MANIFEST_FILE}`);

  if (!(await manifest.exists())) {
    return null;
  }

  try {
    return await manifest.json();
  } catch (err) {
    console.error(`Failed to parse the manifest: ${err}`);

    return null;
  }
}

async function initCmd(args: string[], cache: Cache): Promise<boolean> {
  if (args.length > 1) {
    console.log("Too many arguments");

    return false;
  } else if (args.length === 0) {
    console.log("A Minecraft version is required");

    return false;
  }

  const requiredVersion = args[0]!;
  const versionManifest = await tryFetchVersionManifest(requiredVersion, cache);

  if (!versionManifest || !versionManifest.resolved) {
    console.error(`The specified version '${requiredVersion}' is not found`);

    if (versionManifest) {
      const versions = versionManifest.versions.versions;

      versions.sort((a, b) => {
        const aDate = new Date(a.releaseTime);
        const bDate = new Date(b.releaseTime);

        if (aDate < bDate) {
          return -1;
        } else if (aDate > bDate) {
          return 1;
        }

        return 0;
      });

      console.log("Available versions:");

      for (const version of versions) {
        console.info(version.id);
      }
    }

    return false;
  }

  const manifest = Bun.file(`./${constants.MANIFEST_FILE}`);

  if (await manifest.exists()) {
    console.error("There is already a Minecraft folder");

    return false;
  }

  const content: types.Manifest = {
    minecraft: {
      version: requiredVersion,
    },
  };

  const body = JSON.stringify(content, null, 2);
  await manifest.write(body);

  return true;
}

async function syncCmd(args: string[], cache: Cache): Promise<boolean> {
  if (args.length > 0) {
    console.log("Too many arguments");

    return false;
  }

  const manifest = await tryGetManifest();

  if (!manifest) {
    console.error("Manifest file not found");

    return false;
  }

  if (
    typeof manifest?.minecraft?.version !== "string" ||
    manifest.minecraft.version === ""
  ) {
    console.error("Bad manifest: Minecraft version is not specified");

    return false;
  }

  const versionManifest = await tryFetchVersionManifest(
    manifest.minecraft.version,
    cache,
  );

  if (!versionManifest?.resolved) {
    console.error("Bad Minecraft version");

    return false;
  }

  const gameManifest: mojang.GameManifest = (await tryFetchGameManifest(
    versionManifest.resolved,
    cache,
  ))!;

  if (!gameManifest) {
    return false;
  }

  async function downloadClient(): Promise<boolean> {
    const cachePath = `clients/${gameManifest.downloads.client.sha1}`;
    const dstPath = `versions/${gameManifest.id}/${gameManifest.id}.jar`;
    await utils.mkdirFile(dstPath);

    if (
      (await utils.computeSHA1(dstPath)) === gameManifest.downloads.client.sha1
    ) {
      return true;
    }

    if (
      !(await cache.copy(
        cachePath,
        dstPath,
        gameManifest.downloads.client.sha1,
      ))
    ) {
      console.debug(
        `Fetching the game client from '${gameManifest.downloads.client.url}'`,
      );

      try {
        const response = await fetch(gameManifest.downloads.client.url);

        if (response.body === null) {
          console.error(
            `Response from '${gameManifest.downloads.client.url}' returned null`,
          );

          return false;
        }

        await cache.saveStream(cachePath, response.body);
      } catch (err) {
        console.error(
          `Failed to download the game client from '${gameManifest.downloads.client.url}': ${err}`,
        );

        return false;
      }
    }

    await cache.copy(cachePath, dstPath, null);

    return true;
  }

  if (!(await downloadClient())) {
    return false;
  }

  async function downloadLibraries(): Promise<boolean> {
    for (const library of gameManifest.libraries) {
      if (!mojang.isAllowed(library.rules, {})) {
        continue;
      }

      const cachePath = `libraries/${library.downloads.artifact.sha1}`;
      const dstPath = `libraries/${library.downloads.artifact.path}`;
      await utils.mkdirFile(dstPath);

      if (
        (await utils.computeSHA1(dstPath)) === library.downloads.artifact.sha1
      ) {
        continue;
      }

      if (
        !(await cache.copy(cachePath, dstPath, library.downloads.artifact.sha1))
      ) {
        console.debug(
          `Fetching the library '${library.downloads.artifact.path}' from '${library.downloads.artifact.url}'`,
        );

        try {
          const response = await fetch(library.downloads.artifact.url);

          if (response.body === null) {
            console.error(
              `Response from '${library.downloads.artifact.url}' returned null`,
            );

            return false;
          }

          await cache.saveStream(cachePath, response.body);
        } catch (err) {
          console.error(
            `Failed to download the library '${library.downloads.artifact.path}' from '${library.downloads.artifact.url}': ${err}`,
          );

          return false;
        }
      }

      await cache.copy(cachePath, dstPath, null);
    }

    return true;
  }

  if (!(await downloadLibraries())) {
    return false;
  }

  let index: mojang.AssetsIndex = null!;

  async function downloadAssetsIndex(): Promise<boolean> {
    const cachePath = `indexes/${gameManifest.assetIndex.sha1}`;
    const dstPath = `assets/indexes/${gameManifest.assetIndex.id}.json`;
    await utils.mkdirFile(dstPath);

    if (!(await cache.copy(cachePath, dstPath, gameManifest.assetIndex.sha1))) {
      console.debug(
        `Fetching the assets index from '${gameManifest.assetIndex.url}'`,
      );

      try {
        const response = await fetch(gameManifest.assetIndex.url);

        if (response.body === null) {
          console.error(
            `Response from '${gameManifest.assetIndex.url}' returned null`,
          );

          return false;
        }

        await cache.saveStream(cachePath, response.body);
      } catch (err) {
        console.error(
          `Failed to fetch the assets index from '${gameManifest.assetIndex.url}': ${err}`,
        );

        return false;
      }
    }

    await cache.copy(cachePath, dstPath, null);
    const file = await cache.fetch(cachePath, null);

    index = await file!.json();

    return true;
  }

  if (!(await downloadAssetsIndex())) {
    return false;
  }

  async function downloadAssetObjects(): Promise<boolean> {
    for (const key in index.objects) {
      const object = index.objects[key]!;

      const cachePath = `objects/${object.hash}`;
      const objectPath = `${object.hash.slice(0, 2)}/${object.hash}`;
      const dstPath = `assets/objects/${objectPath}`;
      await utils.mkdirFile(dstPath);

      if (!(await cache.copy(cachePath, dstPath, object.hash))) {
        const url = `${mojang.ASSET_ENDPOINT}/${objectPath}`;

        console.debug(`Fetching the object '${key} from '${url}'`);

        try {
          const response = await fetch(url);

          if (response.body === null) {
            console.error(`Response from '${url}' returned null`);

            return false;
          }

          await cache.saveStream(cachePath, response.body);
        } catch (err) {
          console.error(
            `Failed to fetch the object '${key}' from '${url}': ${err}`,
          );

          return false;
        }
      }

      await cache.copy(cachePath, dstPath, null);
    }

    return true;
  }

  if (!(await downloadAssetObjects())) {
    return false;
  }

  return true;
}

async function runCmd(args: string[], cache: Cache): Promise<boolean> {
  if (args.length > 0) {
    console.log("Too many arguments");

    return false;
  }

  const manifest = await tryGetManifest();

  if (!manifest) {
    console.error("Manifest file not found");

    return false;
  }

  if (
    typeof manifest?.minecraft?.version !== "string" ||
    manifest.minecraft.version === ""
  ) {
    console.error("Bad manifest: Minecraft version is not specified");

    return false;
  }

  const versionManifest = await tryFetchVersionManifest(
    manifest.minecraft.version,
    cache,
  );

  if (!versionManifest?.resolved) {
    console.error("Bad Minecraft version");

    return false;
  }

  const gameManifest = await tryFetchGameManifest(
    versionManifest.resolved,
    cache,
  );

  if (!gameManifest) {
    return false;
  }

  const username = manifest.minecraft.args?.username || "Steve";
  const uuid =
    manifest.minecraft.args?.uuid || "019dd51d-ffff-799e-906b-30e005c5db99";
  const accessToken = manifest.minecraft.args?.accessToken || "foobar";
  const xuid = manifest.minecraft.args?.xuid || "0";
  const mainClass = manifest.minecraft.mainClass || gameManifest.mainClass;

  let classpath = "";

  {
    const paths = [];
    const glob = new bun.Glob(`**/*.jar`);

    for await (const file of glob.scan("libraries")) {
      paths.push(`libraries/${file}`);
    }

    if (manifest.minecraft.libraries) {
      paths.push(manifest.minecraft.libraries);
    }

    paths.push(
      `versions/${manifest.minecraft.version}/${manifest.minecraft.version}.jar`,
    );

    classpath = paths.join(path.delimiter);
  }

  let execArgs: string[] = ["java"];

  function pushArguments(...args: string[]) {
    for (const arg of args) {
      // TODO:
      if (arg.includes("${natives_directory}")) {
        continue;
      }

      execArgs.push(
        arg
          .replaceAll("${launcher_name}", "mcli")
          .replaceAll("${launcher_version}", "1.0")
          .replaceAll("${classpath}", classpath)
          .replaceAll("${auth_player_name}", username)
          .replaceAll("${version_name}", manifest!.minecraft.version)
          .replaceAll("${game_directory}", process.cwd())
          .replaceAll("${assets_root}", `${process.cwd()}/assets/`)
          .replaceAll("${assets_index_name}", gameManifest!.assetIndex.id)
          .replaceAll("${auth_uuid}", uuid)
          .replaceAll("${auth_access_token}", accessToken)
          .replaceAll("${clientid}", "mcli")
          .replaceAll("${auth_xuid}", xuid)
          .replaceAll("${version_type}", gameManifest!.type),
      );
    }
  }

  for (const arg of gameManifest.arguments["default-user-jvm"]) {
    if (!mojang.isAllowed(arg.rules, {})) {
      continue;
    }

    pushArguments(...arg.value);
  }

  for (const arg of gameManifest.arguments.jvm) {
    if (typeof arg === "string") {
      pushArguments(arg);

      continue;
    }

    if (!mojang.isAllowed(arg.rules, {})) {
      continue;
    }

    if (typeof arg.value === "string") {
      pushArguments(arg.value);
    } else {
      pushArguments(...arg.value);
    }
  }

  execArgs.push(mainClass);

  for (const arg of gameManifest.arguments.game) {
    if (typeof arg === "string") {
      pushArguments(arg);

      continue;
    }

    if (!mojang.isAllowed(arg.rules, {})) {
      continue;
    }

    if (typeof arg.value === "string") {
      pushArguments(arg.value);
    } else {
      pushArguments(...arg.value);
    }
  }

  Bun.spawn(execArgs, {
    stderr: 'inherit',
    stdout: 'inherit',
  });

  return true;
}

async function main(args: string[]) {
  const homedir = os.homedir();
  const basedir = `${homedir}/.mcli`;

  const cache = new Cache(`${basedir}/`);
  await cache.init();

  if (args.length === 0) {
    printHelp();

    return;
  }

  if (args[0] === "sync") {
    if (!(await syncCmd(args.slice(1), cache))) {
      process.exit(1);
    }
  } else if (args[0] === "init") {
    if (!(await initCmd(args.slice(1), cache))) {
      process.exit(1);
    }
  } else if (args[0] === "run") {
    if (!(await runCmd(args.slice(1), cache))) {
      process.exit(1);
    }
  } else {
    console.log(`Unknown command: '${args[0]}'`);

    process.exit(1);
  }
}

const args = process.argv.slice(2);

await main(args);
