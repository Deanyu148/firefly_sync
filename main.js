"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  FireflySyncView: () => FireflySyncView,
  VIEW_TYPE_FIREFLY_SYNC: () => VIEW_TYPE_FIREFLY_SYNC,
  default: () => FireflySyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");
var import_node_path2 = require("node:path");

// src/git.ts
var import_node_child_process = require("node:child_process");
var import_node_util = require("node:util");
var import_node_path = require("node:path");
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
async function runGit(repositoryPath, args) {
  const result = await execFileAsync("git", args, {
    cwd: repositoryPath,
    windowsHide: true,
    maxBuffer: 30 * 1024 * 1024,
    encoding: "utf8"
  });
  return toText(result.stdout);
}
async function runGitAllowDiffExit(repositoryPath, args) {
  try {
    return await runGit(repositoryPath, args);
  } catch (error) {
    const gitError = error;
    if (Number(gitError.code) === 1) return toText(gitError.stdout);
    throw error;
  }
}
async function assertGitRepository(repositoryPath) {
  await runGit(repositoryPath, ["rev-parse", "--show-toplevel"]);
}
async function getCurrentBranch(repositoryPath) {
  return (await runGit(repositoryPath, ["branch", "--show-current"])).trim();
}
async function getGitStatuses(repositoryPath, paths) {
  const args = ["status", "--porcelain=v1", "--untracked-files=all", "-z"];
  if (paths && paths.length > 0) args.push("--", ...paths);
  const output = await runGit(repositoryPath, args);
  const statuses = parseGitStatus(output);
  await Promise.all(
    statuses.map(async (status) => {
      try {
        status.diff = await getPathDiff(repositoryPath, status.path);
      } catch {
        status.diff = void 0;
      }
    })
  );
  return statuses;
}
function parseGitStatus(output) {
  const records = output.includes("\0") ? output.split("\0") : output.split(/\r?\n/);
  const statuses = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]?.trimEnd();
    if (!record) continue;
    const indexStatus = record.slice(0, 1);
    const workTreeStatus = record.slice(1, 2);
    let path = record.slice(3);
    if (indexStatus === "R" || workTreeStatus === "R") {
      path = records[index + 1] ?? path;
      index += 1;
    } else if (path.includes(" -> ")) {
      path = path.slice(path.lastIndexOf(" -> ") + 4);
    }
    statuses.push({
      path: path.replaceAll("\\", "/"),
      status: statusLabel(indexStatus, workTreeStatus),
      indexStatus,
      workTreeStatus
    });
  }
  return statuses;
}
function statusLabel(indexStatus, workTreeStatus) {
  if (indexStatus === "?" && workTreeStatus === "?") return "\u672A\u8DDF\u8E2A";
  if (indexStatus === "A" || workTreeStatus === "A") return "\u65B0\u589E";
  if (indexStatus === "D" || workTreeStatus === "D") return "\u5220\u9664";
  if (indexStatus === "R" || workTreeStatus === "R") return "\u91CD\u547D\u540D";
  if (indexStatus === "U" || workTreeStatus === "U") return "\u51B2\u7A81";
  return "\u4FEE\u6539";
}
async function getPathDiff(repositoryPath, path) {
  const status = await getPathStatus(repositoryPath, path);
  if (status?.indexStatus === "?" && status.workTreeStatus === "?") {
    return getUntrackedDiff(repositoryPath, path);
  }
  return runGitAllowDiffExit(repositoryPath, ["diff", "HEAD", "--", path]).catch(() => "");
}
async function getPathStatus(repositoryPath, path) {
  try {
    const output = await runGit(repositoryPath, ["status", "--porcelain=v1", "--untracked-files=all", "-z", "--", path]);
    return parseGitStatus(output)[0];
  } catch {
    return void 0;
  }
}
async function getUntrackedDiff(repositoryPath, path) {
  const { readFile } = await import("node:fs/promises");
  const absolutePath = resolveRepositoryPath(repositoryPath, path);
  try {
    const content = await readFile(absolutePath);
    if (isBinary(content)) return `Binary file ${path} is not shown.`;
    return formatNewFileDiff(path, content.toString("utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `\u65E0\u6CD5\u8BFB\u53D6\u672A\u8DDF\u8E2A\u6587\u4EF6 ${path}: ${detail}`;
  }
}
async function getSyncPreviews(repositoryPath, inputs) {
  const previews = [];
  for (const input of inputs) previews.push(await getSyncPreview(repositoryPath, input));
  return previews;
}
async function getSyncPreview(repositoryPath, input) {
  const { readFile } = await import("node:fs/promises");
  const targetAbsolutePath = resolveBlogPostPath(repositoryPath, input.targetRelativePath);
  const source = await readFile(input.sourceAbsolutePath);
  let target;
  try {
    target = await readFile(targetAbsolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (target && target.equals(source)) return { ...input, statusLabel: "\u65E0\u53D8\u5316", diff: "" };
  if (!target) {
    return {
      ...input,
      statusLabel: "\u65B0\u589E",
      diff: isBinary(source) ? `Binary file ${input.targetRelativePath} is not shown.` : formatNewFileDiff(input.targetRelativePath, source.toString("utf8"))
    };
  }
  const diff = isBinary(target) || isBinary(source) ? `Binary files ${input.targetRelativePath} differ.` : await getFilePairDiff(repositoryPath, input.targetRelativePath, targetAbsolutePath, input.sourceAbsolutePath);
  return { ...input, statusLabel: "\u4FEE\u6539", diff };
}
async function getFilePairDiff(repositoryPath, targetRelativePath, targetAbsolutePath, sourceAbsolutePath) {
  const raw = await runGitAllowDiffExit(repositoryPath, [
    "diff",
    "--no-index",
    "--no-ext-diff",
    "--unified=3",
    "--",
    targetAbsolutePath,
    sourceAbsolutePath
  ]);
  return normalizePairDiff(raw, targetRelativePath);
}
function normalizePairDiff(diff, targetRelativePath) {
  if (!diff.trim()) return "";
  return diff.replace(/\r\n/g, "\n").split("\n").map((line) => {
    if (line.startsWith("diff --git ")) return `diff --git a/${targetRelativePath} b/${targetRelativePath}`;
    if (line.startsWith("--- ")) return `--- a/${targetRelativePath}`;
    if (line.startsWith("+++ ")) return `+++ b/${targetRelativePath}`;
    return line;
  }).join("\n").replace(/\n+$/, "");
}
function formatNewFileDiff(path, content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const hasTrailingNewline = normalized.endsWith("\n");
  const withoutTrailingNewline = hasTrailingNewline ? normalized.slice(0, -1) : normalized;
  const lines = withoutTrailingNewline.length > 0 ? withoutTrailingNewline.split("\n") : [""];
  const body = lines.map((line) => `+${line}`).join("\n");
  const newlineMarker = hasTrailingNewline ? "" : "\n\\ No newline at end of file";
  return [
    `diff --git a/${path} b/${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    `${body}${newlineMarker}`
  ].join("\n");
}
function isBinary(content) {
  return content.subarray(0, Math.min(content.length, 8192)).includes(0);
}
function resolveRepositoryPath(repositoryPath, relativePath) {
  const root = (0, import_node_path.resolve)(repositoryPath);
  const target = (0, import_node_path.resolve)(root, relativePath.replaceAll("/", import_node_path.sep));
  const relation = (0, import_node_path.relative)(root, target);
  if (relation === ".." || relation.startsWith(`..${import_node_path.sep}`) || relation.includes(`${import_node_path.sep}..${import_node_path.sep}`)) {
    throw new Error(`\u62D2\u7EDD\u8BBF\u95EE\u535A\u5BA2\u4ED3\u5E93\u4E4B\u5916\u7684\u8DEF\u5F84\uFF1A${relativePath}`);
  }
  return target;
}
function resolveBlogPostPath(repositoryPath, relativePath) {
  const postsRoot = (0, import_node_path.resolve)(repositoryPath, "src", "content", "posts");
  const target = resolveRepositoryPath(repositoryPath, relativePath);
  const relation = (0, import_node_path.relative)(postsRoot, target);
  if (relation === "" || relation === ".." || relation.startsWith(`..${import_node_path.sep}`) || relation.includes(`${import_node_path.sep}..${import_node_path.sep}`)) {
    throw new Error(`\u540C\u6B65\u76EE\u6807\u5FC5\u987B\u4F4D\u4E8E\u535A\u5BA2 src/content/posts \u5185\uFF1A${relativePath}`);
  }
  return target;
}
async function copyToBlog(repositoryPath, entries) {
  const { copyFile, mkdir } = await import("node:fs/promises");
  for (const entry of entries) {
    const target = resolveBlogPostPath(repositoryPath, entry.targetRelativePath);
    await mkdir((0, import_node_path.dirname)(target), { recursive: true });
    await copyFile(entry.sourceAbsolutePath, target);
  }
}
async function commitAndPush(repositoryPath, relativePaths, commitMessage, remote, branch) {
  if (relativePaths.length === 0) throw new Error("\u6CA1\u6709\u53EF\u63D0\u4EA4\u7684\u6587\u4EF6\u3002");
  await runGit(repositoryPath, ["add", "--", ...relativePaths]);
  const staged = await runGit(repositoryPath, ["diff", "--cached", "--name-only", "--", ...relativePaths]);
  if (!staged.trim()) return "\u6CA1\u6709\u68C0\u6D4B\u5230\u65B0\u7684 Git \u4FEE\u6539\uFF0C\u672A\u521B\u5EFA\u63D0\u4EA4\u3002";
  await runGit(repositoryPath, ["commit", "-m", commitMessage, "--", ...relativePaths]);
  const pushArgs = ["push", remote];
  if (branch) pushArgs.push(branch);
  await runGit(repositoryPath, pushArgs);
  return `\u5DF2\u63D0\u4EA4 ${relativePaths.length} \u4E2A\u6587\u4EF6\u5E76\u63A8\u9001\u5230 ${remote}${branch ? `/${branch}` : ""}\u3002`;
}
function gitErrorMessage(error) {
  const gitError = error;
  return toText(gitError.stderr) || toText(gitError.stdout) || gitError.message || String(error);
}
function toText(value) {
  return value === void 0 ? "" : Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}

// src/modal.ts
var import_obsidian = require("obsidian");

// src/tree.ts
function buildTree(entries) {
  const root = {
    name: "",
    isFile: false,
    children: [],
    collapsed: false
  };
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    let parent = root;
    const parts = entry.path.split("/");
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;
      let child = parent.children.find((candidate) => candidate.name === part);
      if (!child) {
        child = {
          name: part,
          path,
          isFile,
          children: [],
          collapsed: false
        };
        parent.children.push(child);
      }
      parent = child;
    }
  }
  return root;
}

// src/modal.ts
var SyncSelectionModal = class extends import_obsidian.Modal {
  constructor(app, entries, currentPath, gitStatuses, defaultMode, loadPreviews, onSubmit) {
    super(app);
    this.selected = /* @__PURE__ */ new Set();
    this.searchQuery = "";
    this.collapsedPaths = /* @__PURE__ */ new Set();
    this.entries = entries;
    this.currentPath = currentPath;
    this.gitStatuses = new Map(gitStatuses.map((status) => [status.path, status]));
    this.defaultMode = defaultMode;
    this.mode = defaultMode;
    this.loadPreviews = loadPreviews;
    this.onSubmit = onSubmit;
    this.modalEl.addClass("firefly-sync-modal");
  }
  onOpen() {
    this.setTitle("\u9009\u62E9\u540C\u6B65\u5185\u5BB9");
    this.initializeSelection();
    this.render();
  }
  onClose() {
    this.contentEl.empty();
  }
  render() {
    const container = this.contentEl;
    container.empty();
    container.createEl("p", {
      text: "\u4EE5 Obsidian \u6587\u4EF6\u6D4F\u89C8\u5668\u7684\u76EE\u5F55\u6811\u9009\u62E9\u6587\u7AE0\u3002\u786E\u8BA4\u540E\u4F1A\u5148\u663E\u793A\u76EE\u6807\u535A\u5BA2\u7684 Git \u4FEE\u6539\u548C\u5DEE\u5F02\u3002",
      cls: "firefly-sync-setting-note"
    });
    new import_obsidian.Setting(container).setName("\u540C\u6B65\u8303\u56F4").setDesc("\u5F53\u524D\u6587\u7AE0\u9ED8\u8BA4\u53EA\u9009\u4E2D\u5F53\u524D\u6253\u5F00\u7684 Markdown\uFF1B\u6574\u4E2A Vault \u4F1A\u6309\u76EE\u5F55\u6811\u52FE\u9009\u6240\u6709\u53EF\u540C\u6B65 Markdown\u3002").addDropdown(
      (dropdown) => dropdown.addOption("current", "\u5F53\u524D\u6587\u7AE0").addOption("vault", "\u6574\u4E2A Vault").setValue(this.mode).onChange((value) => {
        this.mode = value;
        this.initializeSelection();
        this.renderTree();
      })
    );
    new import_obsidian.Setting(container).setName("\u7B5B\u9009\u6587\u7AE0").addText(
      (text) => text.setPlaceholder("\u641C\u7D22\u6587\u4EF6\u6216\u76EE\u5F55...").onChange((value) => {
        this.searchQuery = value.toLocaleLowerCase().trim();
        this.renderTree();
      })
    );
    const actions = container.createDiv({ cls: "firefly-sync-selection-actions" });
    this.countEl = actions.createSpan();
    const selectAll = actions.createEl("button", { text: "\u5168\u9009" });
    selectAll.addEventListener("click", () => {
      for (const entry of this.filteredEntries()) this.selected.add(entry.path);
      this.renderTree();
    });
    const clear = actions.createEl("button", { text: "\u6E05\u7A7A" });
    clear.addEventListener("click", () => {
      this.selected.clear();
      this.renderTree();
    });
    this.treeEl = container.createDiv({ cls: "firefly-sync-tree" });
    this.renderTree();
    const buttons = container.createDiv({ cls: "modal-button-container" });
    const cancel = buttons.createEl("button", { text: "\u53D6\u6D88" });
    cancel.addEventListener("click", () => this.close());
    const submit = buttons.createEl("button", { text: "\u67E5\u770B\u9009\u4E2D\u5DEE\u5F02", cls: "mod-cta" });
    submit.addEventListener("click", () => void this.showDiffForSelection());
  }
  initializeSelection() {
    const candidates = this.visibleEntries();
    if (this.mode === "current") {
      this.selected = new Set(
        this.currentPath && candidates.some((entry) => entry.path === this.currentPath) ? [this.currentPath] : []
      );
      return;
    }
    this.selected = new Set(candidates.map((entry) => entry.path));
  }
  visibleEntries() {
    if (this.mode === "vault") return this.entries;
    return this.currentPath ? this.entries.filter((entry) => entry.path === this.currentPath) : [];
  }
  filteredEntries() {
    if (!this.searchQuery) return this.visibleEntries();
    return this.visibleEntries().filter((entry) => entry.path.toLocaleLowerCase().includes(this.searchQuery));
  }
  renderTree() {
    if (!this.treeEl) return;
    this.treeEl.empty();
    const entries = this.filteredEntries();
    if (entries.length === 0) {
      this.treeEl.createDiv({ cls: "firefly-sync-tree-empty", text: "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684 Markdown \u6587\u7AE0\u3002" });
      this.updateSelectionCount();
      return;
    }
    const root = buildTree(entries);
    this.renderChildren(this.treeEl, root.children, 0);
    this.updateSelectionCount();
  }
  renderChildren(parent, children, depth) {
    for (const node of children) this.renderNode(parent, node, depth);
  }
  renderNode(parent, node, depth) {
    const row = parent.createDiv({ cls: "firefly-sync-tree-row" });
    row.style.paddingLeft = `${depth * 16 + 4}px`;
    const descendantPaths = this.getLeafPaths(node);
    const checkedCount = descendantPaths.filter((path) => this.selected.has(path)).length;
    const checked = descendantPaths.length > 0 && checkedCount === descendantPaths.length;
    if (checked) row.addClass("is-selected");
    if (!node.isFile) {
      const toggle = row.createSpan({ cls: "collapse-icon", text: this.collapsedPaths.has(node.path ?? "") ? "\u25B8" : "\u25BE" });
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        this.toggleCollapsed(node.path ?? "");
      });
    } else {
      row.createSpan({ cls: "collapse-icon", text: " " });
    }
    const checkbox = row.createEl("input", { type: "checkbox" });
    checkbox.checked = checked;
    checkbox.indeterminate = checkedCount > 0 && !checked;
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      for (const path of descendantPaths) {
        if (checkbox.checked) this.selected.add(path);
        else this.selected.delete(path);
      }
      this.renderTree();
    });
    row.createSpan({ cls: "firefly-sync-file-icon", text: node.isFile ? "\u25A4" : "\u25B0" });
    row.createSpan({ cls: "firefly-sync-file-name", text: node.name });
    if (node.isFile && node.path) {
      const status = this.gitStatuses.get(this.statusKey(node.path));
      row.createSpan({ cls: "firefly-sync-file-state", text: status?.status ?? "\u5F85\u6BD4\u8F83" });
      row.addEventListener("dblclick", () => void this.showSingleDiff(node.path));
    } else {
      row.createSpan({ cls: "firefly-sync-file-state", text: `${descendantPaths.length}` });
    }
    row.addEventListener("click", () => {
      if (node.isFile) {
        const path = node.path;
        if (!path) return;
        if (this.selected.has(path)) this.selected.delete(path);
        else this.selected.add(path);
        this.renderTree();
      } else {
        this.toggleCollapsed(node.path ?? "");
      }
    });
    if (!node.isFile && !this.collapsedPaths.has(node.path ?? "")) {
      this.renderChildren(parent, node.children, depth + 1);
    }
  }
  statusKey(vaultPath) {
    return `src/content/posts/${vaultPath}`;
  }
  getLeafPaths(node) {
    if (node.isFile) return node.path ? [node.path] : [];
    return node.children.flatMap((child) => this.getLeafPaths(child));
  }
  toggleCollapsed(path) {
    if (this.collapsedPaths.has(path)) this.collapsedPaths.delete(path);
    else this.collapsedPaths.add(path);
    this.renderTree();
  }
  updateSelectionCount() {
    this.countEl?.setText(`${this.selected.size} \u7BC7\u6587\u7AE0\u5DF2\u9009\u62E9${this.defaultMode === "current" ? "\uFF08\u9ED8\u8BA4\u5F53\u524D\u6587\u7AE0\uFF09" : ""}`);
  }
  async showSingleDiff(path) {
    try {
      const previews = await this.loadPreviews([path]);
      new DiffReviewModal(this.app, previews, this.onSubmit).open();
    } catch (error) {
      new import_obsidian.Notice(`\u8BFB\u53D6\u5DEE\u5F02\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async showDiffForSelection() {
    const paths = [...this.selected].sort();
    if (paths.length === 0) {
      new import_obsidian.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u7BC7\u6587\u7AE0\u3002");
      return;
    }
    try {
      const previews = await this.loadPreviews(paths);
      new DiffReviewModal(this.app, previews, this.onSubmit).open();
    } catch (error) {
      new import_obsidian.Notice(`\u8BFB\u53D6\u5DEE\u5F02\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }
  }
};
var DiffReviewModal = class extends import_obsidian.Modal {
  constructor(app, previews, onSubmit) {
    super(app);
    this.selected = /* @__PURE__ */ new Set();
    this.previews = previews;
    this.onSubmit = onSubmit;
    this.selected = new Set(previews.map((preview) => preview.targetRelativePath));
    this.modalEl.addClass("firefly-sync-modal");
  }
  onOpen() {
    this.setTitle("\u67E5\u770B Git \u4FEE\u6539\u4E0E\u5DEE\u5F02");
    this.render();
    if (this.previews[0]) this.renderPreview(this.previews[0]);
  }
  onClose() {
    this.contentEl.empty();
  }
  render() {
    const container = this.contentEl;
    container.empty();
    container.createEl("p", {
      text: "\u8FD9\u91CC\u663E\u793A\u590D\u5236\u5230 FireFly \u535A\u5BA2\u540E\u5C06\u4EA7\u751F\u7684 Git diff\u3002\u5DE6\u4FA7\u53EF\u53D6\u6D88\u52FE\u9009\u4E0D\u9700\u8981\u540C\u6B65\u7684\u6587\u4EF6\u3002",
      cls: "firefly-sync-setting-note"
    });
    const layout = container.createDiv({ cls: "firefly-sync-diff-layout" });
    this.listEl = layout.createDiv({ cls: "firefly-sync-diff-list" });
    this.diffEl = layout.createDiv({ cls: "firefly-sync-diff" });
    this.renderList();
    const buttons = container.createDiv({ cls: "modal-button-container" });
    const cancel = buttons.createEl("button", { text: "\u8FD4\u56DE" });
    cancel.addEventListener("click", () => this.close());
    const submit = buttons.createEl("button", { text: "\u540C\u6B65\u5E76\u63A8\u9001", cls: "mod-cta" });
    submit.addEventListener("click", () => {
      const paths = [...this.selected].sort();
      if (paths.length === 0) {
        new import_obsidian.Notice("\u8BF7\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u9700\u8981\u540C\u6B65\u7684\u6587\u4EF6\u3002");
        return;
      }
      this.close();
      const selectedPreviews = this.previews.filter((preview) => this.selected.has(preview.targetRelativePath));
      void this.onSubmit(selectedPreviews);
    });
  }
  renderList() {
    if (!this.listEl) return;
    this.listEl.empty();
    for (const preview of this.previews) {
      const row = this.listEl.createDiv({ cls: "firefly-sync-tree-row" });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.selected.has(preview.targetRelativePath);
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(preview.targetRelativePath);
        else this.selected.delete(preview.targetRelativePath);
      });
      row.createSpan({ cls: "firefly-sync-file-name", text: preview.targetRelativePath });
      row.createSpan({ cls: "firefly-sync-file-state", text: preview.statusLabel });
      row.addEventListener("click", () => this.renderPreview(preview));
    }
  }
  renderPreview(preview) {
    if (!this.diffEl) return;
    this.diffEl.empty();
    this.diffEl.createEl("div", {
      cls: "firefly-sync-diff-title",
      text: `${preview.targetRelativePath}  \xB7  ${preview.statusLabel}`
    });
    if (!preview.diff) {
      this.diffEl.createEl("div", {
        text: "\u6CA1\u6709\u5DEE\u5F02\u3002\u540C\u6B65\u6B64\u6587\u4EF6\u4E0D\u4F1A\u6539\u53D8\u76EE\u6807\u535A\u5BA2\u4E2D\u7684\u5185\u5BB9\u3002",
        cls: "firefly-sync-setting-note"
      });
      return;
    }
    for (const line of preview.diff.replace(/\r\n/g, "\n").split("\n")) {
      const lineEl = this.diffEl.createDiv({ cls: "firefly-sync-diff-line", text: line || " " });
      if (line.startsWith("+") && !line.startsWith("+++")) lineEl.addClass("is-add");
      if (line.startsWith("-") && !line.startsWith("---")) lineEl.addClass("is-remove");
      if (line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("---") || line.startsWith("+++")) {
        lineEl.addClass("is-header");
      }
    }
  }
};
var GitStatusModal = class extends import_obsidian.Modal {
  constructor(app, status) {
    super(app);
    this.status = status;
    this.modalEl.addClass("firefly-sync-modal");
  }
  onOpen() {
    this.setTitle(`Git \u4FEE\u6539 \xB7 ${this.status.path}`);
    const diff = this.contentEl.createDiv({ cls: "firefly-sync-diff" });
    if (!this.status.diff) {
      diff.setText("\u5F53\u524D\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5DEE\u5F02\u3002");
      return;
    }
    for (const line of this.status.diff.replace(/\r\n/g, "\n").split("\n")) {
      const lineEl = diff.createDiv({ cls: "firefly-sync-diff-line", text: line || " " });
      if (line.startsWith("+") && !line.startsWith("+++")) lineEl.addClass("is-add");
      if (line.startsWith("-") && !line.startsWith("---")) lineEl.addClass("is-remove");
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/settings.ts
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  blogRepositoryPath: "",
  remote: "origin",
  branch: "",
  commitMessage: "\u540C\u6B65 Obsidian \u6587\u7AE0\u5230 FireFly",
  ignoreFolders: [".obsidian"]
};
var FireflySyncSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "FireFly Sync" });
    containerEl.createEl("p", {
      text: "\u914D\u7F6E\u672C\u5730 FireFly \u535A\u5BA2 Git \u4ED3\u5E93\u3002\u540C\u6B65\u65F6\u5C06\u590D\u5236 Markdown \u6587\u7AE0\u53CA images \u76EE\u5F55\u4E0B\u7684\u56FE\u7247\u3002",
      cls: "firefly-sync-setting-note"
    });
    new import_obsidian2.Setting(containerEl).setName("\u535A\u5BA2\u4ED3\u5E93\u8DEF\u5F84").setDesc("\u4F8B\u5982 E:\\FireFly\u3002\u5FC5\u987B\u662F\u5DF2\u7ECF\u521D\u59CB\u5316\u7684 Git \u4ED3\u5E93\u3002").addText(
      (text) => text.setPlaceholder("E:\\FireFly").setValue(this.plugin.settings.blogRepositoryPath).onChange(async (value) => {
        this.plugin.settings.blogRepositoryPath = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Git \u8FDC\u7AEF").setDesc("\u9ED8\u8BA4 origin\u3002").addText(
      (text) => text.setValue(this.plugin.settings.remote).onChange(async (value) => {
        this.plugin.settings.remote = value.trim() || "origin";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u63A8\u9001\u5206\u652F").setDesc("\u7559\u7A7A\u65F6\u4F7F\u7528\u5F53\u524D\u68C0\u51FA\u7684\u5206\u652F\u3002").addText(
      (text) => text.setPlaceholder("main").setValue(this.plugin.settings.branch).onChange(async (value) => {
        this.plugin.settings.branch = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u63D0\u4EA4\u4FE1\u606F").addText(
      (text) => text.setValue(this.plugin.settings.commitMessage).onChange(async (value) => {
        this.plugin.settings.commitMessage = value.trim() || DEFAULT_SETTINGS.commitMessage;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Vault \u5FFD\u7565\u76EE\u5F55").setDesc("\u6574\u4E2A Vault \u6A21\u5F0F\u4E0D\u4F1A\u540C\u6B65\u8FD9\u4E9B\u76EE\u5F55\uFF0C\u9017\u53F7\u5206\u9694\u3002\u9ED8\u8BA4\u5FFD\u7565 .obsidian\u3002").addText(
      (text) => text.setValue(this.plugin.settings.ignoreFolders.join(", ")).onChange(async (value) => {
        this.plugin.settings.ignoreFolders = value.split(",").map((folder) => folder.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean);
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/main.ts
var VIEW_TYPE_FIREFLY_SYNC = "firefly-sync-view";
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"]);
var FireflySyncPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.statusByPath = /* @__PURE__ */ new Map();
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FireflySyncSettingTab(this.app, this));
    this.addCommand({
      id: "open-sync-panel",
      name: "\u6253\u5F00\u540C\u6B65\u9762\u677F",
      callback: () => void this.activateView()
    });
    this.addCommand({
      id: "sync-current-note",
      name: "\u540C\u6B65\u5F53\u524D\u6587\u7AE0",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.openSelectionModal(file, "current");
        return true;
      }
    });
    this.addCommand({
      id: "sync-full-firefly-vault",
      name: "\u540C\u6B65\u6574\u4E2A FireFly Vault",
      callback: () => void this.openSelectionModal(void 0, "vault")
    });
    this.addRibbonIcon("git-pull-request", "\u6253\u5F00 FireFly Sync", () => void this.activateView());
    this.registerView(VIEW_TYPE_FIREFLY_SYNC, (leaf) => new FireflySyncView(leaf, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshView()));
  }
  async onunload() {
    await this.app.workspace.detachLeavesOfType(VIEW_TYPE_FIREFLY_SYNC);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.refreshView();
  }
  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_FIREFLY_SYNC)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? void 0;
      if (!leaf) {
        new import_obsidian3.Notice("\u65E0\u6CD5\u6253\u5F00\u53F3\u4FA7 FireFly Sync \u9762\u677F\u3002");
        return;
      }
      await leaf.setViewState({ type: VIEW_TYPE_FIREFLY_SYNC, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    await this.refreshGitStatus();
  }
  async refreshView() {
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_FIREFLY_SYNC)[0]?.view;
    if (view instanceof FireflySyncView) view.render();
  }
  async refreshGitStatus(showError = true) {
    if (!this.settings.blogRepositoryPath.trim()) {
      this.statusByPath.clear();
      await this.refreshView();
      return;
    }
    try {
      const repository = await this.getBlogRepositoryRoot();
      const statuses = await getGitStatuses(repository);
      this.statusByPath = new Map(statuses.map((status) => [status.path, status]));
      await this.refreshView();
    } catch (error) {
      if (showError) new import_obsidian3.Notice(`\u8BFB\u53D6\u535A\u5BA2 Git \u72B6\u6001\u5931\u8D25\uFF1A${gitErrorMessage(error)}`);
    }
  }
  async openSelectionModal(currentFile, mode = "current") {
    try {
      const repository = await this.getBlogRepositoryRoot();
      if (mode === "vault") await this.assertFullVaultLayout();
      const entries = this.app.vault.getMarkdownFiles().filter((file) => !this.isIgnored(file.path)).map((file) => ({ path: file.path, name: file.name }));
      const statuses = await getGitStatuses(repository);
      this.statusByPath = new Map(statuses.map((status) => [status.path, status]));
      await this.refreshView();
      new SyncSelectionModal(
        this.app,
        entries,
        currentFile?.path,
        statuses,
        mode,
        (paths) => this.buildPreviews(paths, mode),
        (selectedPreviews) => this.syncFiles(selectedPreviews)
      ).open();
    } catch (error) {
      new import_obsidian3.Notice(`\u65E0\u6CD5\u6253\u5F00\u540C\u6B65\u9009\u62E9\u5668\uFF1A${gitErrorMessage(error)}`);
    }
  }
  async buildPreviews(paths, mode) {
    const repository = await this.getBlogRepositoryRoot();
    const files = await this.resolveAllSyncFiles(paths, mode);
    return getSyncPreviews(repository, files);
  }
  async syncFiles(previewsToSync) {
    if (previewsToSync.length === 0) return;
    try {
      const repository = await this.getBlogRepositoryRoot();
      await copyToBlog(repository, previewsToSync);
      const branch = this.settings.branch || await getCurrentBranch(repository);
      if (!branch) throw new Error("\u5F53\u524D\u535A\u5BA2\u4ED3\u5E93\u5904\u4E8E detached HEAD \u72B6\u6001\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u6307\u5B9A\u8981\u63A8\u9001\u7684\u5206\u652F\u3002");
      const message = await commitAndPush(
        repository,
        previewsToSync.map((file) => file.targetRelativePath),
        this.settings.commitMessage,
        this.settings.remote,
        branch
      );
      new import_obsidian3.Notice(message, 8e3);
      await this.refreshGitStatus(false);
    } catch (error) {
      new import_obsidian3.Notice(`\u540C\u6B65\u5931\u8D25\uFF1A`, 1e4);
      await this.refreshGitStatus(false);
    }
  }
  async resolveAllSyncFiles(markdownPaths, mode) {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof import_obsidian3.FileSystemAdapter)) {
      throw new Error("FireFly Sync \u4EC5\u652F\u6301\u684C\u9762\u7AEF\u7684\u672C\u5730\u6587\u4EF6\u7CFB\u7EDF Vault\u3002");
    }
    const vaultBasePath = adapter.getBasePath();
    const allFiles = this.app.vault.getFiles();
    const filesByPath = new Map(allFiles.map((file) => [file.path, file]));
    const syncFiles = [];
    const addedTargetPaths = /* @__PURE__ */ new Set();
    const uniqueMarkdownPaths = [...new Set(markdownPaths)];
    for (const path of uniqueMarkdownPaths) {
      const file = filesByPath.get(path);
      if (!file) throw new Error(`\u9009\u62E9\u7684\u6587\u7AE0\u4E0D\u5B58\u5728\uFF1A`);
      if (this.isIgnored(path)) throw new Error(`\u8BE5\u6587\u4EF6\u4F4D\u4E8E\u5FFD\u7565\u76EE\u5F55\uFF0C\u4E0D\u80FD\u540C\u6B65\uFF1A`);
      const targetRelativePath = ``;
      syncFiles.push({
        vaultPath: path,
        sourceAbsolutePath: (0, import_node_path2.join)(vaultBasePath, ...file.path.split("/")),
        targetRelativePath
      });
      addedTargetPaths.add(targetRelativePath);
    }
    const imageFilesToSync = [];
    if (mode === "vault") {
      for (const file of allFiles) {
        const normPath = file.path.replaceAll("\\", "/");
        if (normPath.startsWith("images/") || normPath === "images") {
          if (IMAGE_EXTENSIONS.has((0, import_node_path2.extname)(file.path).toLowerCase()) || file.extension) {
            imageFilesToSync.push(file);
          }
        }
      }
    } else {
      const referencedImageFiles = /* @__PURE__ */ new Set();
      for (const mdPath of uniqueMarkdownPaths) {
        const mdFile = filesByPath.get(mdPath);
        if (!mdFile) continue;
        const content = await this.app.vault.read(mdFile);
        const imageRefs = this.extractImageReferences(content);
        for (const ref of imageRefs) {
          const linkedFile = this.app.metadataCache.getFirstLinkpathDest(ref, mdFile.path);
          if (linkedFile && IMAGE_EXTENSIONS.has(`.`.toLowerCase())) {
            referencedImageFiles.add(linkedFile);
          } else {
            const cleanRef = ref.replace(/^\.\//, "").replace(/^images\//, "");
            const candidate = filesByPath.get(`images/`) || filesByPath.get(ref);
            if (candidate && IMAGE_EXTENSIONS.has(`.`.toLowerCase())) {
              referencedImageFiles.add(candidate);
            }
          }
        }
      }
      imageFilesToSync.push(...referencedImageFiles);
    }
    for (const imgFile of imageFilesToSync) {
      const normPath = imgFile.path.replaceAll("\\", "/");
      const relativeUnderImages = normPath.startsWith("images/") ? normPath.slice("images/".length) : imgFile.name;
      const targetRelativePath = ``;
      if (!addedTargetPaths.has(targetRelativePath)) {
        syncFiles.push({
          vaultPath: imgFile.path,
          sourceAbsolutePath: (0, import_node_path2.join)(vaultBasePath, ...imgFile.path.split("/")),
          targetRelativePath
        });
        addedTargetPaths.add(targetRelativePath);
      }
    }
    return syncFiles;
  }
  extractImageReferences(content) {
    const results = /* @__PURE__ */ new Set();
    const wikiRegex = /!\[\[([^|\]\r\n]+)(?:\|[^\r\n\]]*)?\]\]/g;
    let match;
    while ((match = wikiRegex.exec(content)) !== null) {
      const ref = match[1]?.trim();
      if (ref) results.add(ref);
    }
    const mdRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+["\x27][^"\x27]*["\x27])?\)/g;
    while ((match = mdRegex.exec(content)) !== null) {
      const rawRef = match[1]?.trim().split("?")[0]?.split("#")[0];
      if (rawRef && !rawRef.startsWith("http://") && !rawRef.startsWith("https://") && !rawRef.startsWith("data:")) {
        results.add(rawRef);
      }
    }
    const htmlRegex = /<img\s+[^>]*?src=["\x27]([^"\x27]+)["\x27]/gi;
    while ((match = htmlRegex.exec(content)) !== null) {
      const rawRef = match[1]?.trim().split("?")[0]?.split("#")[0];
      if (rawRef && !rawRef.startsWith("http://") && !rawRef.startsWith("https://") && !rawRef.startsWith("data:")) {
        results.add(rawRef);
      }
    }
    return [...results];
  }
  async getBlogRepositoryRoot() {
    const configuredPath = this.settings.blogRepositoryPath.trim();
    if (!configuredPath) throw new Error("\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u586B\u5199 FireFly \u535A\u5BA2\u4ED3\u5E93\u8DEF\u5F84\uFF0C\u4F8B\u5982 E:\\FireFly\u3002");
    await assertGitRepository(configuredPath);
    const repository = (await runGit(configuredPath, ["rev-parse", "--show-toplevel"])).trim();
    const { access } = await import("node:fs/promises");
    await access((0, import_node_path2.join)(repository, "src", "content", "posts"));
    return repository;
  }
  async assertFullVaultLayout() {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof import_obsidian3.FileSystemAdapter)) {
      throw new Error("\u540C\u6B65\u6574\u4E2A Vault \u4EC5\u652F\u6301\u684C\u9762\u7AEF\u7684\u672C\u5730\u6587\u4EF6\u7CFB\u7EDF Vault\u3002");
    }
    const vaultPath = adapter.getBasePath();
    const folder = (0, import_node_path2.basename)(vaultPath).toLocaleLowerCase();
    const parent = (0, import_node_path2.basename)((0, import_node_path2.dirname)(vaultPath)).toLocaleLowerCase();
    if (folder !== "firefly" || parent !== "firefly") {
      throw new Error(
        `\u540C\u6B65\u6574\u4E2A Vault \u8981\u6C42\u76EE\u5F55\u4E3A <\u5DE5\u4F5C\u533A>\\firefly\\firefly\uFF0C\u4F8B\u5982 E:\\\u6587\u6863\\firefly\\firefly\u3002\u5F53\u524D Vault\uFF1A${vaultPath}`
      );
    }
    const { stat } = await import("node:fs/promises");
    try {
      if (!(await stat((0, import_node_path2.join)(vaultPath, ".obsidian"))).isDirectory()) throw new Error("not a directory");
    } catch {
      throw new Error(`Vault \u6839\u76EE\u5F55\u7F3A\u5C11 .obsidian\uFF1A${vaultPath}`);
    }
  }
  isIgnored(path) {
    const normalized = path.replaceAll("\\", "/");
    return this.settings.ignoreFolders.some((folder) => {
      const cleaned = folder.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
      return cleaned.length > 0 && (normalized === cleaned || normalized.startsWith(`${cleaned}/`));
    });
  }
};
var FireflySyncView = class extends import_obsidian3.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_FIREFLY_SYNC;
  }
  getDisplayText() {
    return "FireFly Sync";
  }
  getIcon() {
    return "git-pull-request";
  }
  onOpen() {
    this.render();
    return Promise.resolve();
  }
  onClose() {
    this.contentEl.empty();
    return Promise.resolve();
  }
  render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("firefly-sync-shell");
    const panel = container.createDiv({ cls: "firefly-sync-panel" });
    const toolbar = panel.createDiv({ cls: "firefly-sync-toolbar" });
    const icon = toolbar.createSpan({ cls: "firefly-sync-toolbar-icon" });
    (0, import_obsidian3.setIcon)(icon, "git-pull-request");
    toolbar.createSpan({ cls: "firefly-sync-title", text: "FireFly Sync" });
    const refresh = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "\u5237\u65B0 Git \u72B6\u6001" } });
    (0, import_obsidian3.setIcon)(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.plugin.refreshGitStatus());
    const settings = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "\u6253\u5F00 FireFly Sync \u8BBE\u7F6E" } });
    (0, import_obsidian3.setIcon)(settings, "settings");
    settings.addEventListener("click", () => {
      const setting = this.app.setting;
      setting?.open();
      setting?.openTabById(this.plugin.manifest.id);
    });
    const repository = panel.createDiv({ cls: "firefly-sync-repository" });
    repository.setText(this.plugin.settings.blogRepositoryPath || "\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E\u535A\u5BA2\u4ED3\u5E93\u8DEF\u5F84");
    const actions = panel.createDiv({ cls: "firefly-sync-tabs" });
    const current = actions.createEl("button", { text: "\u540C\u6B65\u5F53\u524D\u6587\u7AE0", cls: "mod-cta" });
    current.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? void 0, "current"));
    const vault = actions.createEl("button", { text: "\u540C\u6B65\u6574\u4E2A Vault" });
    vault.addEventListener("click", () => void this.plugin.openSelectionModal(void 0, "vault"));
    const heading = panel.createDiv({ cls: "firefly-sync-section-heading" });
    heading.createSpan({ text: "\u535A\u5BA2 Git \u4FEE\u6539" });
    heading.createSpan({ cls: "firefly-sync-count", text: `${this.plugin.statusByPath.size}` });
    const tree = panel.createDiv({ cls: "firefly-sync-tree" });
    this.renderStatusTree(tree);
    const status = panel.createDiv({ cls: "firefly-sync-status" });
    status.createDiv({
      cls: "firefly-sync-status-line",
      text: "\u9009\u62E9\u6587\u7AE0\u540E\u4F1A\u5148\u9884\u89C8\u76EE\u6807\u535A\u5BA2\u7684 Git diff\uFF1B\u786E\u8BA4\u540E\u53EA\u590D\u5236\u5E76\u63D0\u4EA4\u52FE\u9009\u7684\u6587\u4EF6\u3002"
    });
    const bottom = panel.createDiv({ cls: "firefly-sync-bottom" });
    const open = bottom.createEl("button", { text: "\u6253\u5F00\u540C\u6B65\u9009\u62E9\u5668", cls: "mod-cta" });
    open.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? void 0, "current"));
  }
  renderStatusTree(parent) {
    if (!this.plugin.settings.blogRepositoryPath) {
      parent.createDiv({ cls: "firefly-sync-tree-empty", text: "\u914D\u7F6E\u535A\u5BA2\u4ED3\u5E93\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A Git \u5DE5\u4F5C\u533A\u4FEE\u6539\u3002" });
      return;
    }
    const statuses = [...this.plugin.statusByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    if (statuses.length === 0) {
      parent.createDiv({ cls: "firefly-sync-tree-empty", text: "\u535A\u5BA2 Git \u5DE5\u4F5C\u533A\u6CA1\u6709\u4FEE\u6539\u3002" });
      return;
    }
    for (const gitStatus of statuses) {
      const row = parent.createDiv({ cls: "firefly-sync-tree-row" });
      row.createSpan({ cls: "firefly-sync-file-icon", text: "\u25A4" });
      row.createSpan({ cls: "firefly-sync-file-name", text: gitStatus.path });
      row.createSpan({ cls: "firefly-sync-file-state", text: gitStatus.status });
      row.addEventListener("click", () => new GitStatusModal(this.app, gitStatus).open());
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FireflySyncView,
  VIEW_TYPE_FIREFLY_SYNC
});
