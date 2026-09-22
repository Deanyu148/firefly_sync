"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  FireflySyncView: () => FireflySyncView,
  VIEW_TYPE_FIREFLY_SYNC: () => VIEW_TYPE_FIREFLY_SYNC,
  default: () => FireflySyncPlugin
});
module.exports = __toCommonJS(main_exports);
var import_promises2 = require("fs/promises");
var import_obsidian3 = require("obsidian");
var import_path3 = require("path");

// src/git.ts
var import_promises = require("fs/promises");
var import_child_process = require("child_process");
var import_util = require("util");
var import_path = require("path");
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
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
  if (indexStatus === "?" && workTreeStatus === "?") return "Untracked";
  if (indexStatus === "A" || workTreeStatus === "A") return "Added";
  if (indexStatus === "D" || workTreeStatus === "D") return "Deleted";
  if (indexStatus === "R" || workTreeStatus === "R") return "Renamed";
  if (indexStatus === "U" || workTreeStatus === "U") return "Conflicted";
  return "Modified";
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
  const absolutePath = resolveRepositoryPath(repositoryPath, path);
  try {
    const content = await (0, import_promises.readFile)(absolutePath);
    if (isBinary(content)) return `Binary file ${path} is not shown.`;
    return formatNewFileDiff(path, content.toString("utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `Unable to read untracked file ${path}: ${detail}`;
  }
}
async function getSyncPreviews(repositoryPath, inputs) {
  const previews = [];
  for (const input of inputs) previews.push(await getSyncPreview(repositoryPath, input));
  return previews;
}
async function getSyncPreview(repositoryPath, input) {
  const targetAbsolutePath = resolveBlogPostPath(repositoryPath, input.targetRelativePath);
  const source = await (0, import_promises.readFile)(input.sourceAbsolutePath);
  let target;
  try {
    target = await (0, import_promises.readFile)(targetAbsolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (target && target.equals(source)) return { ...input, statusLabel: "Unchanged", diff: "" };
  if (!target) {
    return {
      ...input,
      statusLabel: "Added",
      diff: isBinary(source) ? `Binary file ${input.targetRelativePath} is not shown.` : formatNewFileDiff(input.targetRelativePath, source.toString("utf8"))
    };
  }
  const diff = isBinary(target) || isBinary(source) ? `Binary files ${input.targetRelativePath} differ.` : await getFilePairDiff(repositoryPath, input.targetRelativePath, targetAbsolutePath, input.sourceAbsolutePath);
  return { ...input, statusLabel: "Modified", diff };
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
  const root = (0, import_path.resolve)(repositoryPath);
  const target = (0, import_path.resolve)(root, relativePath.replaceAll("/", import_path.sep));
  const relation = (0, import_path.relative)(root, target);
  if (relation === ".." || relation.startsWith(`..${import_path.sep}`) || relation.includes(`${import_path.sep}..${import_path.sep}`)) {
    throw new Error(`Access denied outside blog repository: ${relativePath}`);
  }
  return target;
}
function resolveBlogPostPath(repositoryPath, relativePath, allowedPrefix) {
  const target = resolveRepositoryPath(repositoryPath, relativePath);
  if (allowedPrefix) {
    const allowedRoot = (0, import_path.resolve)(repositoryPath, allowedPrefix.replaceAll("/", import_path.sep));
    const relation = (0, import_path.relative)(allowedRoot, target);
    if (relation.startsWith(".." + import_path.sep) || relation === ".." || relation.includes(import_path.sep + ".." + import_path.sep)) {
      throw new Error(`Target path outside specified directory ${allowedPrefix}: ${relativePath}`);
    }
  }
  return target;
}
async function copyToBlog(repositoryPath, entries) {
  for (const entry of entries) {
    const target = resolveBlogPostPath(repositoryPath, entry.targetRelativePath);
    await (0, import_promises.mkdir)((0, import_path.dirname)(target), { recursive: true });
    await (0, import_promises.copyFile)(entry.sourceAbsolutePath, target);
  }
}
async function commitAndPush(repositoryPath, relativePaths, commitMessage, remote, branch, proxyUrl) {
  if (relativePaths.length === 0) throw new Error("No files to commit.");
  await runGit(repositoryPath, ["add", "--", ...relativePaths]);
  const staged = await runGit(repositoryPath, ["diff", "--cached", "--name-only", "--", ...relativePaths]);
  if (!staged.trim()) return "No new Git changes detected, commit not created.";
  await runGit(repositoryPath, ["commit", "-m", commitMessage, "--", ...relativePaths]);
  const pushArgs = [];
  const cleanProxy = proxyUrl?.trim();
  if (cleanProxy) {
    pushArgs.push("-c", `http.proxy=${cleanProxy}`);
  }
  pushArgs.push("push", remote);
  if (branch) pushArgs.push(branch);
  await runGit(repositoryPath, pushArgs);
  const branchLabel = branch ? `/${branch}` : "";
  const proxyLabel = cleanProxy ? ` (via proxy ${cleanProxy})` : "";
  return `Committed ${relativePaths.length} files and pushed to ${remote}${branchLabel}${proxyLabel}.`;
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
  constructor(app, entries, currentPath, gitStatuses, defaultMode, loadPreviews, onSubmit, postsPrefix = "src/content/posts") {
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
    this.postsPrefix = postsPrefix.replace(/^\/+|\/+$/g, "");
    this.modalEl.addClass("firefly-sync-modal");
  }
  onOpen() {
    this.setTitle("Select Posts to Sync");
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
      text: "Select markdown notes using the vault tree. A git diff preview will be shown before pushing to the blog.",
      cls: "firefly-sync-setting-note"
    });
    new import_obsidian.Setting(container).setName("Sync Scope").setDesc("Current note selects active note only; full vault selects all eligible markdown notes.").addDropdown(
      (dropdown) => dropdown.addOption("current", "Current note").addOption("vault", "Full vault").setValue(this.mode).onChange((value) => {
        this.mode = value;
        this.initializeSelection();
        this.renderTree();
      })
    );
    new import_obsidian.Setting(container).setName("Filter notes").addText(
      (text) => text.setPlaceholder("Search files or folders...").onChange((value) => {
        this.searchQuery = value.toLocaleLowerCase().trim();
        this.renderTree();
      })
    );
    const actions = container.createDiv({ cls: "firefly-sync-selection-actions" });
    this.countEl = actions.createSpan();
    const selectAll = actions.createEl("button", { text: "Select all" });
    selectAll.addEventListener("click", () => {
      for (const entry of this.filteredEntries()) this.selected.add(entry.path);
      this.renderTree();
    });
    const clear = actions.createEl("button", { text: "Clear" });
    clear.addEventListener("click", () => {
      this.selected.clear();
      this.renderTree();
    });
    this.treeEl = container.createDiv({ cls: "firefly-sync-tree" });
    this.renderTree();
    const buttons = container.createDiv({ cls: "modal-button-container" });
    const cancel = buttons.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const submit = buttons.createEl("button", { text: "Review Diff", cls: "mod-cta" });
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
      this.treeEl.createDiv({ cls: "firefly-sync-tree-empty", text: "No eligible markdown notes found." });
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
      row.createSpan({ cls: "firefly-sync-file-state", text: status?.status ?? "Pending" });
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
    this.countEl?.setText(`${this.selected.size} notes selected${this.defaultMode === "current" ? " (active note default)" : ""}`);
  }
  async showSingleDiff(path) {
    try {
      const previews = await this.loadPreviews([path]);
      new DiffReviewModal(this.app, previews, this.onSubmit).open();
    } catch (error) {
      new import_obsidian.Notice(`Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async showDiffForSelection() {
    const paths = [...this.selected].sort();
    if (paths.length === 0) {
      new import_obsidian.Notice("Please select at least one note.");
      return;
    }
    try {
      const previews = await this.loadPreviews(paths);
      new DiffReviewModal(this.app, previews, this.onSubmit).open();
    } catch (error) {
      new import_obsidian.Notice(`Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`);
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
    this.setTitle("Review Git Diff");
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
      text: "Review git changes that will be copied and pushed to the FireFly blog. Uncheck any files to exclude.",
      cls: "firefly-sync-setting-note"
    });
    const layout = container.createDiv({ cls: "firefly-sync-diff-layout" });
    this.listEl = layout.createDiv({ cls: "firefly-sync-diff-list" });
    this.diffEl = layout.createDiv({ cls: "firefly-sync-diff" });
    this.renderList();
    const buttons = container.createDiv({ cls: "modal-button-container" });
    const cancel = buttons.createEl("button", { text: "Back" });
    cancel.addEventListener("click", () => this.close());
    const submit = buttons.createEl("button", { text: "Sync & Push", cls: "mod-cta" });
    submit.addEventListener("click", () => {
      const paths = [...this.selected].sort();
      if (paths.length === 0) {
        new import_obsidian.Notice("Please keep at least one file selected.");
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
        text: "No diff. Synchronizing this file will not alter content in the target repository.",
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
    this.setTitle(`Git Change \xB7 ${this.status.path}`);
    const diff = this.contentEl.createDiv({ cls: "firefly-sync-diff" });
    if (!this.status.diff) {
      diff.setText("No diff available to display.");
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
var import_child_process2 = require("child_process");
var import_util2 = require("util");
var import_path2 = require("path");
var execFileAsync2 = (0, import_util2.promisify)(import_child_process2.execFile);
var DEFAULT_SETTINGS = {
  blogRepositoryPath: "",
  blogPostsPath: "src/content/posts",
  blogImagesPath: "src/content/posts/images",
  remote: "origin",
  branch: "",
  commitMessage: "Sync Obsidian notes to FireFly",
  proxyUrl: "",
  ignoreFolders: [".obsidian"]
};
async function pickDirectory(defaultPath) {
  try {
    const electron = window.require?.("electron") ?? window.electron;
    const dialog = electron?.remote?.dialog ?? electron?.dialog;
    if (dialog?.showOpenDialog) {
      const res = await dialog.showOpenDialog({
        defaultPath: defaultPath || void 0,
        properties: ["openDirectory", "dontAddToRecent"]
      });
      if (!res.canceled && res.filePaths?.[0]) {
        return res.filePaths[0];
      }
      return null;
    }
  } catch {
  }
  if (process.platform === "win32") {
    try {
      const initial = defaultPath ? defaultPath.replaceAll("\\", "\\\\") : "";
      const scriptLines = [
        "Add-Type -AssemblyName System.Windows.Forms",
        "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
        "$dialog.Description = 'Select Directory'",
        initial ? `if (Test-Path '${initial}') { $dialog.SelectedPath = '${initial}' }` : "",
        "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
        "    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
        "    Write-Output $dialog.SelectedPath",
        "}"
      ].filter(Boolean).join("; ");
      const result = await execFileAsync2("powershell", ["-NoProfile", "-NonInteractive", "-Command", scriptLines], {
        windowsHide: true,
        encoding: "utf8"
      });
      const path = (result.stdout ?? "").trim().split(/\r?\n/).filter(Boolean).pop();
      return path || null;
    } catch {
    }
  }
  return new Promise((resolveResult) => {
    const input = document.createElement("input");
    input.type = "file";
    input.setAttribute("webkitdirectory", "true");
    input.setAttribute("directory", "true");
    input.style.display = "none";
    document.body.appendChild(input);
    let resolved = false;
    input.addEventListener("change", () => {
      resolved = true;
      const file = input.files?.[0];
      if (!file) {
        document.body.removeChild(input);
        resolveResult(null);
        return;
      }
      const fullPath = file?.path;
      document.body.removeChild(input);
      if (fullPath) {
        const { dirname: dirname3 } = require("path");
        const relativePath = file.webkitRelativePath;
        const depth = relativePath.split("/").length - 1;
        let current = dirname3(fullPath);
        for (let i = 0; i < depth - 1; i++) {
          current = dirname3(current);
        }
        resolveResult(current);
      } else {
        resolveResult(null);
      }
    });
    window.addEventListener(
      "focus",
      () => {
        setTimeout(() => {
          if (!resolved) {
            if (document.body.contains(input)) document.body.removeChild(input);
            resolveResult(null);
          }
        }, 1e3);
      },
      { once: true }
    );
    input.click();
  });
}
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
      text: "Configure local FireFly blog repository, post directory, and media attachment path.",
      cls: "firefly-sync-setting-note"
    });
    let repoTextInput;
    new import_obsidian2.Setting(containerEl).setName("Blog repository path").setDesc("Root directory of the initialized FireFly Git repository (e.g. E:\\FireFly).").addText((text) => {
      repoTextInput = text.inputEl;
      text.setPlaceholder("E:\\FireFly").setValue(this.plugin.settings.blogRepositoryPath).onChange(async (value) => {
        this.plugin.settings.blogRepositoryPath = value.trim();
        await this.plugin.saveSettings();
      });
    }).addButton(
      (button) => button.setButtonText("Browse...").setTooltip("Select blog repository root directory").onClick(async () => {
        const selected = await pickDirectory(this.plugin.settings.blogRepositoryPath);
        if (selected) {
          this.plugin.settings.blogRepositoryPath = selected;
          repoTextInput.value = selected;
          await this.plugin.saveSettings();
        }
      })
    );
    let postsTextInput;
    new import_obsidian2.Setting(containerEl).setName("Blog posts directory").setDesc("Path relative to blog repository root, default: src/content/posts.").addText((text) => {
      postsTextInput = text.inputEl;
      text.setPlaceholder("src/content/posts").setValue(this.plugin.settings.blogPostsPath || DEFAULT_SETTINGS.blogPostsPath).onChange(async (value) => {
        this.plugin.settings.blogPostsPath = this.normalizeRelativePath(value.trim()) || DEFAULT_SETTINGS.blogPostsPath;
        await this.plugin.saveSettings();
      });
    }).addButton(
      (button) => button.setButtonText("Browse...").setTooltip("Select blog posts directory").onClick(async () => {
        const repo = this.plugin.settings.blogRepositoryPath;
        const initial = repo ? (0, import_path2.resolve)(repo, this.plugin.settings.blogPostsPath || "src/content/posts") : void 0;
        const selected = await pickDirectory(initial);
        if (selected) {
          const rel = this.computeRelativePath(repo, selected);
          this.plugin.settings.blogPostsPath = rel;
          postsTextInput.value = rel;
          await this.plugin.saveSettings();
        }
      })
    );
    let imagesTextInput;
    new import_obsidian2.Setting(containerEl).setName("Blog images/media directory").setDesc("Path relative to blog repository root, default: src/content/posts/images.").addText((text) => {
      imagesTextInput = text.inputEl;
      text.setPlaceholder("src/content/posts/images").setValue(this.plugin.settings.blogImagesPath || DEFAULT_SETTINGS.blogImagesPath).onChange(async (value) => {
        this.plugin.settings.blogImagesPath = this.normalizeRelativePath(value.trim()) || DEFAULT_SETTINGS.blogImagesPath;
        await this.plugin.saveSettings();
      });
    }).addButton(
      (button) => button.setButtonText("Browse...").setTooltip("Select blog images/media directory").onClick(async () => {
        const repo = this.plugin.settings.blogRepositoryPath;
        const initial = repo ? (0, import_path2.resolve)(repo, this.plugin.settings.blogImagesPath || "src/content/posts/images") : void 0;
        const selected = await pickDirectory(initial);
        if (selected) {
          const rel = this.computeRelativePath(repo, selected);
          this.plugin.settings.blogImagesPath = rel;
          imagesTextInput.value = rel;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Git remote").setDesc("Remote name (default: origin).").addText(
      (text) => text.setValue(this.plugin.settings.remote).onChange(async (value) => {
        this.plugin.settings.remote = value.trim() || "origin";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Push branch").setDesc("Leave empty to use the current checked-out branch.").addText(
      (text) => text.setPlaceholder("main").setValue(this.plugin.settings.branch).onChange(async (value) => {
        this.plugin.settings.branch = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Commit message").addText(
      (text) => text.setValue(this.plugin.settings.commitMessage).onChange(async (value) => {
        this.plugin.settings.commitMessage = value.trim() || DEFAULT_SETTINGS.commitMessage;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Network proxy").setDesc("Optional. Used for Git push. Supports http://, https://, socks4://, socks5:// (e.g. socks5://127.0.0.1:7897). Leave blank for direct connection.").addText(
      (text) => text.setPlaceholder("socks5://127.0.0.1:7897").setValue(this.plugin.settings.proxyUrl || "").onChange(async (value) => {
        this.plugin.settings.proxyUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Vault ignored folders").setDesc("Full vault mode will skip these folders, comma-separated. Default: .obsidian.").addText(
      (text) => text.setValue(this.plugin.settings.ignoreFolders.join(", ")).onChange(async (value) => {
        this.plugin.settings.ignoreFolders = value.split(",").map((folder) => folder.trim().replace(/^\/+|\/+$/g, "")).filter(Boolean);
        await this.plugin.saveSettings();
      })
    );
  }
  normalizeRelativePath(p) {
    return p.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  }
  computeRelativePath(repoRoot, chosenPath) {
    if (repoRoot) {
      const r = (0, import_path2.relative)((0, import_path2.resolve)(repoRoot), (0, import_path2.resolve)(chosenPath));
      if (!r.startsWith(".." + import_path2.sep) && !r.includes(import_path2.sep + "..")) {
        return r.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
      }
    }
    return this.normalizeRelativePath(chosenPath);
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
      name: "Open sync panel",
      callback: () => void this.activateView()
    });
    this.addCommand({
      id: "sync-current-note",
      name: "Sync current note",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (!checking) void this.openSelectionModal(file, "current");
        return true;
      }
    });
    this.addCommand({
      id: "sync-full-firefly-vault",
      name: "Sync full FireFly vault",
      callback: () => void this.openSelectionModal(void 0, "vault")
    });
    this.addRibbonIcon("git-pull-request", "Open FireFly Sync", () => void this.activateView());
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
        new import_obsidian3.Notice("Unable to open the FireFly Sync side panel.");
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
      if (showError) new import_obsidian3.Notice(`Failed to read blog Git status: ${gitErrorMessage(error)}`);
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
        (selectedPreviews) => this.syncFiles(selectedPreviews),
        this.getPostsPrefix()
      ).open();
    } catch (error) {
      new import_obsidian3.Notice(`Unable to open sync selector: ${gitErrorMessage(error)}`);
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
      if (!branch) throw new Error("Target blog repository is in a detached HEAD state. Please specify a branch in settings.");
      const message = await commitAndPush(
        repository,
        previewsToSync.map((file) => file.targetRelativePath),
        this.settings.commitMessage,
        this.settings.remote,
        branch,
        this.settings.proxyUrl
      );
      new import_obsidian3.Notice(message, 8e3);
      await this.refreshGitStatus(false);
    } catch (error) {
      new import_obsidian3.Notice(`Sync failed: ${gitErrorMessage(error)}`, 1e4);
      await this.refreshGitStatus(false);
    }
  }
  getPostsPrefix() {
    const p = (this.settings.blogPostsPath || DEFAULT_SETTINGS.blogPostsPath).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    return p || "src/content/posts";
  }
  getImagesPrefix() {
    const p = (this.settings.blogImagesPath || DEFAULT_SETTINGS.blogImagesPath).replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    return p || "src/content/posts/images";
  }
  async resolveAllSyncFiles(markdownPaths, mode) {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof import_obsidian3.FileSystemAdapter)) {
      throw new Error("FireFly Sync only supports local desktop file system vaults.");
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
      const targetRelativePath = `${this.getPostsPrefix()}/${file.path.replaceAll("\\", "/")}`;
      syncFiles.push({
        vaultPath: path,
        sourceAbsolutePath: (0, import_path3.join)(vaultBasePath, ...file.path.split("/")),
        targetRelativePath
      });
      addedTargetPaths.add(targetRelativePath);
    }
    const imageFilesToSync = [];
    if (mode === "vault") {
      for (const file of allFiles) {
        const normPath = file.path.replaceAll("\\", "/");
        if (normPath.startsWith("images/") || normPath === "images") {
          if (IMAGE_EXTENSIONS.has((0, import_path3.extname)(file.path).toLowerCase()) || file.extension) {
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
          if (linkedFile && IMAGE_EXTENSIONS.has(`.${linkedFile.extension}`.toLowerCase())) {
            referencedImageFiles.add(linkedFile);
          } else {
            const cleanRef = ref.replace(/^\.\//, "").replace(/^images\//, "");
            const candidate = filesByPath.get(`images/${cleanRef}`) || filesByPath.get(ref);
            if (candidate && IMAGE_EXTENSIONS.has(`.${candidate.extension}`.toLowerCase())) {
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
      const targetRelativePath = `${this.getImagesPrefix()}/${relativeUnderImages}`;
      if (!addedTargetPaths.has(targetRelativePath)) {
        syncFiles.push({
          vaultPath: imgFile.path,
          sourceAbsolutePath: (0, import_path3.join)(vaultBasePath, ...imgFile.path.split("/")),
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
    if (!configuredPath) throw new Error("Please configure the FireFly blog repository path in plugin settings (e.g. E:\\FireFly).");
    await assertGitRepository(configuredPath);
    const repository = (await runGit(configuredPath, ["rev-parse", "--show-toplevel"])).trim();
    const postsDir = this.getPostsPrefix();
    await (0, import_promises2.access)((0, import_path3.join)(repository, ...postsDir.split("/")));
    return repository;
  }
  async assertFullVaultLayout() {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof import_obsidian3.FileSystemAdapter)) {
      throw new Error("Full vault sync only supports local desktop file system vaults.");
    }
    const vaultPath = adapter.getBasePath();
    const folder = (0, import_path3.basename)(vaultPath).toLocaleLowerCase();
    const parent = (0, import_path3.basename)((0, import_path3.dirname)(vaultPath)).toLocaleLowerCase();
    if (folder !== "firefly" || parent !== "firefly") {
      throw new Error(
        `Full vault sync requires a path structured as <workspace>\\firefly\\firefly. Current vault: ${vaultPath}`
      );
    }
    try {
      if (!(await (0, import_promises2.stat)((0, import_path3.join)(vaultPath, ".obsidian"))).isDirectory()) throw new Error("not a directory");
    } catch {
      throw new Error(`Vault root missing .obsidian: ${vaultPath}`);
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
    const refresh = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Refresh Git status" } });
    (0, import_obsidian3.setIcon)(refresh, "refresh-cw");
    refresh.addEventListener("click", () => void this.plugin.refreshGitStatus());
    const settings = toolbar.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Open FireFly Sync settings" } });
    (0, import_obsidian3.setIcon)(settings, "settings");
    settings.addEventListener("click", () => {
      const setting = this.app.setting;
      setting?.open();
      setting?.openTabById(this.plugin.manifest.id);
    });
    const repository = panel.createDiv({ cls: "firefly-sync-repository" });
    repository.setText(this.plugin.settings.blogRepositoryPath || "Please configure blog repository path in settings");
    const actions = panel.createDiv({ cls: "firefly-sync-tabs" });
    const current = actions.createEl("button", { text: "Sync Current Note", cls: "mod-cta" });
    current.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? void 0, "current"));
    const vault = actions.createEl("button", { text: "Sync Full Vault" });
    vault.addEventListener("click", () => void this.plugin.openSelectionModal(void 0, "vault"));
    const heading = panel.createDiv({ cls: "firefly-sync-section-heading" });
    heading.createSpan({ text: "Blog Git Changes" });
    heading.createSpan({ cls: "firefly-sync-count", text: `${this.plugin.statusByPath.size}` });
    const tree = panel.createDiv({ cls: "firefly-sync-tree" });
    this.renderStatusTree(tree);
    const status = panel.createDiv({ cls: "firefly-sync-status" });
    status.createDiv({
      cls: "firefly-sync-status-line",
      text: "Review git diff previews after selecting notes. Only confirmed changes will be copied and committed."
    });
    const bottom = panel.createDiv({ cls: "firefly-sync-bottom" });
    const open = bottom.createEl("button", { text: "Open Sync Selector", cls: "mod-cta" });
    open.addEventListener("click", () => void this.plugin.openSelectionModal(this.app.workspace.getActiveFile() ?? void 0, "current"));
  }
  renderStatusTree(parent) {
    if (!this.plugin.settings.blogRepositoryPath) {
      parent.createDiv({ cls: "firefly-sync-tree-empty", text: "Working tree changes will appear here after configuring the blog repository." });
      return;
    }
    const statuses = [...this.plugin.statusByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
    if (statuses.length === 0) {
      parent.createDiv({ cls: "firefly-sync-tree-empty", text: "Blog working directory is clean." });
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
