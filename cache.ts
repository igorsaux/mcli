// Copyright (C) 2026 Igor Spichkin
// SPDX-License-Identifier: Apache-2.0

import * as bun from "bun";
import * as fs from "node:fs/promises";
import * as utils from "./utils";

export default class Cache {
  private folder: string;

  constructor(root: string) {
    this.folder = `${root}/cache`;
  }

  async init() {
    await fs.mkdir(this.folder, {
      recursive: true,
    });
  }

  async fetch(path: string, sha1: string | null): Promise<Bun.BunFile | null> {
    path = `${this.folder}/${path}`;

    const file = Bun.file(path);

    if (!(await file.exists())) {
      return null;
    }

    if (sha1) {
      const stream = file.stream();
      const hasher = new bun.CryptoHasher("sha1");

      for await (const chunk of stream) {
        hasher.update(chunk);
      }

      if (hasher.digest("hex") !== sha1) {
        await file.delete();

        return null;
      }
    }

    return file;
  }

  async copy(path: string, dst: string, sha1: string | null): Promise<boolean> {
    if (sha1 && (await utils.computeSHA1(dst)) === sha1) {
      return true;
    }

    const file = await this.fetch(path, sha1);

    if (!file) {
      return false;
    }

    path = `${this.folder}/${path}`;

    await utils.mkdirFile(path);
    await fs.copyFile(path, dst);

    return true;
  }

  async save(
    path: string,
    content:
      | string
      | bun.BunFile
      | ArrayBuffer
      | SharedArrayBuffer
      | bun.ArrayBufferView<ArrayBufferLike>
      | Request
      | Response,
  ) {
    path = `${this.folder}/${path}`;

    await utils.mkdirFile(path);

    const file = Bun.file(path);
    await file.write(content);
  }

  async saveStream(path: string, stream: ReadableStream<any>) {
    path = `${this.folder}/${path}`;

    await utils.mkdirFile(path);

    const file = Bun.file(path);
    const sink = file.writer();

    for await (const chunk of stream) {
      await sink.write(chunk);
    }

    await sink.end();
  }
}
