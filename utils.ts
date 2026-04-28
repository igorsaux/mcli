import { CryptoHasher } from "bun";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const SEPARATOR = path.sep;

export async function mkdirFile(path: string) {
  const parts = path.split(SEPARATOR);
  parts.pop();

  await fs.mkdir(parts.join(SEPARATOR), {
    recursive: true,
  });
}

export async function computeSHA1(path: string): Promise<string | null> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  const stream = file.stream();
  const hasher = new CryptoHasher("sha1");

  for await (const chunk of stream) {
    hasher.update(chunk);
  }

  return hasher.digest("hex");
}
