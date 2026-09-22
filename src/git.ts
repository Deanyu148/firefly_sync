import { copyFile, mkdir, readFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { dirname, relative, resolve, sep } from "path";

const execFileAsync = promisify(execFile);

export interface GitFileStatus {
	path: string;
	status: string;
	indexStatus: string;
	workTreeStatus: string;
	diff?: string;
}

export interface SyncPreviewInput {
	vaultPath: string;
	sourceAbsolutePath: string;
	targetRelativePath: string;
}

export interface SyncPreview extends SyncPreviewInput {
	statusLabel: "Added" | "Modified" | "Unchanged";
	diff: string;
}

interface GitExecError {
	stdout?: string | Buffer;
	stderr?: string | Buffer;
	message?: string;
	code?: number | string;
}

export async function runGit(repositoryPath: string, args: string[]): Promise<string> {
	const result = await execFileAsync("git", args, {
		cwd: repositoryPath,
		windowsHide: true,
		maxBuffer: 30 * 1024 * 1024,
		encoding: "utf8",
	});
	return toText(result.stdout);
}

async function runGitAllowDiffExit(repositoryPath: string, args: string[]): Promise<string> {
	try {
		return await runGit(repositoryPath, args);
	} catch (error) {
		const gitError = error as GitExecError;
		if (Number(gitError.code) === 1) return toText(gitError.stdout);
		throw error;
	}
}

export async function assertGitRepository(repositoryPath: string): Promise<void> {
	await runGit(repositoryPath, ["rev-parse", "--show-toplevel"]);
}

export async function getCurrentBranch(repositoryPath: string): Promise<string> {
	return (await runGit(repositoryPath, ["branch", "--show-current"])).trim();
}

export async function getGitStatuses(repositoryPath: string, paths?: string[]): Promise<GitFileStatus[]> {
	const args = ["status", "--porcelain=v1", "--untracked-files=all", "-z"];
	if (paths && paths.length > 0) args.push("--", ...paths);
	const output = await runGit(repositoryPath, args);
	const statuses = parseGitStatus(output);
	await Promise.all(
		statuses.map(async (status) => {
			try {
				status.diff = await getPathDiff(repositoryPath, status.path);
			} catch {
				status.diff = undefined;
			}
		}),
	);
	return statuses;
}

export function parseGitStatus(output: string): GitFileStatus[] {
	const records = output.includes("\0") ? output.split("\0") : output.split(/\r?\n/);
	const statuses: GitFileStatus[] = [];
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
			workTreeStatus,
		});
	}
	return statuses;
}

function statusLabel(indexStatus: string, workTreeStatus: string): string {
	if (indexStatus === "?" && workTreeStatus === "?") return "Untracked";
	if (indexStatus === "A" || workTreeStatus === "A") return "Added";
	if (indexStatus === "D" || workTreeStatus === "D") return "Deleted";
	if (indexStatus === "R" || workTreeStatus === "R") return "Renamed";
	if (indexStatus === "U" || workTreeStatus === "U") return "Conflicted";
	return "Modified";
}

export async function getPathDiff(repositoryPath: string, path: string): Promise<string> {
	const status = await getPathStatus(repositoryPath, path);
	if (status?.indexStatus === "?" && status.workTreeStatus === "?") {
		return getUntrackedDiff(repositoryPath, path);
	}
	return runGitAllowDiffExit(repositoryPath, ["diff", "HEAD", "--", path]).catch(() => "");
}

async function getPathStatus(repositoryPath: string, path: string): Promise<GitFileStatus | undefined> {
	try {
		const output = await runGit(repositoryPath, ["status", "--porcelain=v1", "--untracked-files=all", "-z", "--", path]);
		return parseGitStatus(output)[0];
	} catch {
		return undefined;
	}
}

async function getUntrackedDiff(repositoryPath: string, path: string): Promise<string> {
	const absolutePath = resolveRepositoryPath(repositoryPath, path);
	try {
		const content = await readFile(absolutePath);
		if (isBinary(content)) return `Binary file ${path} is not shown.`;
		return formatNewFileDiff(path, content.toString("utf8"));
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		return `Unable to read untracked file ${path}: ${detail}`;
	}
}

export async function getSyncPreviews(repositoryPath: string, inputs: SyncPreviewInput[]): Promise<SyncPreview[]> {
	const previews: SyncPreview[] = [];
	for (const input of inputs) previews.push(await getSyncPreview(repositoryPath, input));
	return previews;
}

export async function getSyncPreview(repositoryPath: string, input: SyncPreviewInput): Promise<SyncPreview> {
	const targetAbsolutePath = resolveBlogPostPath(repositoryPath, input.targetRelativePath);
	const source = await readFile(input.sourceAbsolutePath);
	let target: Buffer | undefined;
	try {
		target = await readFile(targetAbsolutePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}

	if (target && target.equals(source)) return { ...input, statusLabel: "Unchanged", diff: "" };
	if (!target) {
		return {
			...input,
			statusLabel: "Added",
			diff: isBinary(source)
				? `Binary file ${input.targetRelativePath} is not shown.`
				: formatNewFileDiff(input.targetRelativePath, source.toString("utf8")),
		};
	}
	const diff =
		isBinary(target) || isBinary(source)
			? `Binary files ${input.targetRelativePath} differ.`
			: await getFilePairDiff(repositoryPath, input.targetRelativePath, targetAbsolutePath, input.sourceAbsolutePath);
	return { ...input, statusLabel: "Modified", diff };
}

async function getFilePairDiff(
	repositoryPath: string,
	targetRelativePath: string,
	targetAbsolutePath: string,
	sourceAbsolutePath: string,
): Promise<string> {
	const raw = await runGitAllowDiffExit(repositoryPath, [
		"diff",
		"--no-index",
		"--no-ext-diff",
		"--unified=3",
		"--",
		targetAbsolutePath,
		sourceAbsolutePath,
	]);
	return normalizePairDiff(raw, targetRelativePath);
}

function normalizePairDiff(diff: string, targetRelativePath: string): string {
	if (!diff.trim()) return "";
	return diff
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((line) => {
			if (line.startsWith("diff --git ")) return `diff --git a/${targetRelativePath} b/${targetRelativePath}`;
			if (line.startsWith("--- ")) return `--- a/${targetRelativePath}`;
			if (line.startsWith("+++ ")) return `+++ b/${targetRelativePath}`;
			return line;
		})
		.join("\n")
		.replace(/\n+$/, "");
}

export function formatNewFileDiff(path: string, content: string): string {
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
		`${body}${newlineMarker}`,
	].join("\n");
}

function isBinary(content: Buffer): boolean {
	return content.subarray(0, Math.min(content.length, 8192)).includes(0);
}

function resolveRepositoryPath(repositoryPath: string, relativePath: string): string {
	const root = resolve(repositoryPath);
	const target = resolve(root, relativePath.replaceAll("/", sep));
	const relation = relative(root, target);
	if (relation === ".." || relation.startsWith(`..${sep}`) || relation.includes(`${sep}..${sep}`)) {
		throw new Error(`Access denied outside blog repository: ${relativePath}`);
	}
	return target;
}

export function resolveBlogPostPath(repositoryPath: string, relativePath: string, allowedPrefix?: string): string {
	const target = resolveRepositoryPath(repositoryPath, relativePath);
	if (allowedPrefix) {
		const allowedRoot = resolve(repositoryPath, allowedPrefix.replaceAll("/", sep));
		const relation = relative(allowedRoot, target);
		if (relation.startsWith(".." + sep) || relation === ".." || relation.includes(sep + ".." + sep)) {
			throw new Error(`Target path outside specified directory ${allowedPrefix}: ${relativePath}`);
		}
	}
	return target;
}

export async function copyToBlog(
	repositoryPath: string,
	entries: Array<{ sourceAbsolutePath: string; targetRelativePath: string }>,
): Promise<void> {
	for (const entry of entries) {
		const target = resolveBlogPostPath(repositoryPath, entry.targetRelativePath);
		await mkdir(dirname(target), { recursive: true });
		await copyFile(entry.sourceAbsolutePath, target);
	}
}

export async function commitAndPush(
	repositoryPath: string,
	relativePaths: string[],
	commitMessage: string,
	remote: string,
	branch?: string,
	proxyUrl?: string,
): Promise<string> {
	if (relativePaths.length === 0) throw new Error("No files to commit.");
	await runGit(repositoryPath, ["add", "--", ...relativePaths]);
	const staged = await runGit(repositoryPath, ["diff", "--cached", "--name-only", "--", ...relativePaths]);
	if (!staged.trim()) return "No new Git changes detected, commit not created.";
	await runGit(repositoryPath, ["commit", "-m", commitMessage, "--", ...relativePaths]);
	const pushArgs: string[] = [];
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

export function gitErrorMessage(error: unknown): string {
	const gitError = error as GitExecError;
	return toText(gitError.stderr) || toText(gitError.stdout) || gitError.message || String(error);
}

function toText(value: string | Buffer | undefined): string {
	return value === undefined ? "" : Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}
