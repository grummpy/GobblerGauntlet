import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { DEFAULT_PORT } from "../src/core/constants.js";

const root = path.resolve(import.meta.dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("arcade.json matches the manifest and points at real files", () => {
  const manifest = JSON.parse(read("arcade.json"));
  assert.equal(manifest.name, "Gobbler Gauntlet");
  assert.equal(manifest.id, "gobblergauntlet");
  assert.equal(manifest.players, 4);
  assert.equal(manifest.minPlayers, 1);
  assert.equal(manifest.port, DEFAULT_PORT);
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.input, ["keyboard", "gamepad"]);
  assert.equal(manifest.launch.web, "index.html");
  const files = [
    manifest.icon,
    manifest.cover,
    manifest.launch.web,
    manifest.launch.mac,
    manifest.launch.windows,
    manifest.launch.linux,
    "server.py",
    "src/main.js",
  ];
  for (const file of files) {
    const full = path.join(root, file);
    assert.ok(fs.existsSync(full), file);
    assert.ok(fs.statSync(full).size > 0, file);
  }
  for (const script of [manifest.launch.mac, manifest.launch.linux]) {
    const mode = fs.statSync(path.join(root, script)).mode;
    assert.ok(mode & 0o111, `${script} should be executable`);
  }
});

test("the game ships with no remote CDN references", () => {
  const files = ["index.html", "src/main.js"];
  const stack = ["src/core", "src/ui"];
  for (const dir of stack) {
    for (const name of fs.readdirSync(path.join(root, dir))) {
      if (name.endsWith(".js")) files.push(path.join(dir, name));
    }
  }
  for (const file of files) {
    const text = read(file);
    assert.equal(/https?:\/\//.test(text), false, file);
  }
});

test("launchers and the server stay on the arcade port", () => {
  const server = read("server.py");
  assert.match(server, /127\.0\.0\.1/);
  assert.match(server, /arcade\.json/);
  assert.match(server, /--no-browser/);
  for (const file of ["launch-linux.sh", "launch-mac.command", "launch-windows.bat"]) {
    const text = read(file);
    assert.match(text, /server\.py/);
    assert.match(text, /Python 3/);
  }
});
