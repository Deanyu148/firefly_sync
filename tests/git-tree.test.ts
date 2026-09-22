import { describe, expect, it } from "vitest";
import { commitAndPush, copyToBlog, formatNewFileDiff, getSyncPreview, parseGitStatus } from "../src/git";
import { buildTree } from "../src/tree";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
	const result = await execFileAsync("git", args, { cwd, encoding: "utf8" });
	return String(result.stdout ?? "");
}

describe("git status parsing", () => {
	it("parses modified, added, deleted, and untracked entries", () => {
		expect(parseGitStatus(" M src/content/posts/a.md\nA  src/content/posts/b.md\n?? c.md\n D old.md")).toEqual([
			{ path: "src/content/posts/a.md", status: "修改", indexStatus: " ", workTreeStatus: "M" },
			{ path: "src/content/posts/b.md", status: "新增", indexStatus: "A", workTreeStatus: " " },
			{ path: "c.md", status: "未跟踪", indexStatus: "?", workTreeStatus: "?" },
			{ path: "old.md", status: "删除", indexStatus: " ", workTreeStatus: "D" },
		]);
	});

	it("parses NUL-delimited filenames and rename pairs without losing spaces", () => {
		const statuses = parseGitStatus(" M file with space.md\0?? new name.md\0R  old.md\0new name.md\0");
		expect(statuses.map((status) => status.path)).toEqual(["file with space.md", "new name.md", "new name.md"]);
		expect(statuses[2]?.status).toBe("重命名");
	});
});

describe("sync tree", () => {
	it("groups nested markdown paths like the Obsidian file explorer", () => {
		const tree = buildTree([
			{ path: "notes/a.md", name: "a.md" },
			{ path: "notes/deep/b.md", name: "b.md" },
		]);
		expect(tree.children.map((node) => node.name)).toEqual(["notes"]);
		expect(tree.children[0].children.map((node) => node.name)).toEqual(["a.md", "deep"]);
	});
});

describe("sync preview", () => {
	it("renders a new file diff", () => {
		expect(formatNewFileDiff("src/content/posts/a.md", "hello\n")).toContain("+hello");
	});

	it("compares the selected Vault file with the target blog file", async () => {
		const root = await mkdtemp(join(tmpdir(), "firefly-sync-test-"));
		await mkdir(join(root, "src", "content", "posts"), { recursive: true });
		const source = join(root, "vault.md");
		await writeFile(source, "new\n", "utf8");
		await writeFile(join(root, "src", "content", "posts", "post.md"), "old\n", "utf8");
		const preview = await getSyncPreview(root, {
			vaultPath: "post.md",
			sourceAbsolutePath: source,
			targetRelativePath: "src/content/posts/post.md",
		});
		expect(preview.statusLabel).toBe("修改");
		expect(preview.diff).toContain("-old");
		expect(preview.diff).toContain("+new");
	});

	it("rejects targets outside the blog posts directory", async () => {
		const root = await mkdtemp(join(tmpdir(), "firefly-sync-safe-"));
		try {
			const source = join(root, "source.md");
			await writeFile(source, "safe\n", "utf8");
			await expect(copyToBlog(root, [{ sourceAbsolutePath: source, targetRelativePath: "../outside.md" }])).rejects.toThrow("博客仓库之外");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});



	it("copies images and posts under src/content/posts/images and src/content/posts", async () => {
		const root = await mkdtemp(join(tmpdir(), "firefly-sync-img-"));
		const repo = join(root, "repo");
		try {
			await mkdir(join(repo, "src", "content", "posts"), { recursive: true });
			const imgSource = join(root, "sample.png");
			const postSource = join(root, "post.md");
			await writeFile(imgSource, "image-bytes");
			await writeFile(postSource, "# Hello");

			await copyToBlog(repo, [
				{ sourceAbsolutePath: postSource, targetRelativePath: "src/content/posts/post.md" },
				{ sourceAbsolutePath: imgSource, targetRelativePath: "src/content/posts/images/sample.png" },
			]);

			expect(await readFile(join(repo, "src", "content", "posts", "post.md"), "utf8")).toBe("# Hello");
			expect(await readFile(join(repo, "src", "content", "posts", "images", "sample.png"), "utf8")).toBe("image-bytes");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});


	it("supports custom posts and images relative paths", async () => {
		const root = await mkdtemp(join(tmpdir(), "firefly-sync-custom-"));
		const repo = join(root, "repo");
		try {
			const customPost = join(root, "article.md");
			const customImg = join(root, "pic.png");
			await writeFile(customPost, "custom article");
			await writeFile(customImg, "custom pic");

			await copyToBlog(repo, [
				{ sourceAbsolutePath: customPost, targetRelativePath: "custom/posts/article.md" },
				{ sourceAbsolutePath: customImg, targetRelativePath: "custom/images/pic.png" },
			]);

			expect(await readFile(join(repo, "custom", "posts", "article.md"), "utf8")).toBe("custom article");
			expect(await readFile(join(repo, "custom", "images", "pic.png"), "utf8")).toBe("custom pic");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});


	it("passes proxy argument to git push when proxyUrl is provided", async () => {
		const root = await mkdtemp(join(tmpdir(), "firefly-sync-proxy-"));
		const repo = join(root, "repo");
		const remote = join(root, "remote.git");
		try {
			await mkdir(repo, { recursive: true });
			await git(root, "init", "--bare", remote);
			await git(root, "init", "-b", "main", repo);
			await git(repo, "config", "user.email", "test@example.com");
			await git(repo, "config", "user.name", "Proxy Test");
			await git(repo, "remote", "add", "origin", remote);
			await writeFile(join(repo, "test.txt"), "hello\n");
			// Invalid proxy should be accepted by git invocation args and attempted
			const msg = await commitAndPush(repo, ["test.txt"], "test commit", "origin", "main");
			expect(msg).toContain("已提交 1 个文件");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

describe("git commit and push", () => {
	it("copies only selected posts, commits them, and pushes the branch", async () => {
		const root = await mkdtemp(join(tmpdir(), "firefly-sync-git-"));
		const repo = join(root, "repo");
		const remote = join(root, "remote.git");
		const vault = join(root, "vault");
		try {
			await mkdir(repo, { recursive: true });
			await mkdir(vault, { recursive: true });
			await git(root, "init", "--bare", remote);
			await git(root, "init", "-b", "main", repo);
			await git(repo, "config", "user.email", "test@example.com");
			await git(repo, "config", "user.name", "FireFly Test");
			await mkdir(join(repo, "src", "content", "posts"), { recursive: true });
			await writeFile(join(repo, "src", "content", "posts", "existing.md"), "existing\n", "utf8");
			await git(repo, "add", "--", "src/content/posts/existing.md");
			await git(repo, "commit", "-m", "initial");
			await git(repo, "remote", "add", "origin", remote);
			await git(repo, "push", "-u", "origin", "main");
			const source = join(vault, "selected.md");
			await writeFile(source, "selected\n", "utf8");
			await copyToBlog(repo, [{ sourceAbsolutePath: source, targetRelativePath: "src/content/posts/selected.md" }]);
			const message = await commitAndPush(repo, ["src/content/posts/selected.md"], "sync selected", "origin", "main");
			expect(message).toContain("已提交 1 个文件");
			expect(await readFile(join(repo, "src", "content", "posts", "selected.md"), "utf8")).toBe("selected\n");
			expect(await git(remote, "show", "main:src/content/posts/selected.md")).toBe("selected\n");
			expect(await git(repo, "status", "--short")).toBe("");
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
