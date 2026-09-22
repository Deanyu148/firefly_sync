export interface SyncEntry {
	path: string;
	name: string;
}

export type SelectionMode = "current" | "vault";

export interface SyncTreeNode {
	name: string;
	path?: string;
	isFile: boolean;
	children: SyncTreeNode[];
	collapsed: boolean;
}

export function buildTree(entries: SyncEntry[]): SyncTreeNode {
	const root: SyncTreeNode = {
		name: "",
		isFile: false,
		children: [],
		collapsed: false,
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
					collapsed: false,
				};
				parent.children.push(child);
			}
			parent = child;
		}
	}
	return root;
}
