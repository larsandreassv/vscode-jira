import * as vscode from "vscode";
import * as cp from "child_process";

export function activate(context: vscode.ExtensionContext) {
  // Register the tree data provider
  const gitBranchProvider = new GitBranchTreeDataProvider();
  vscode.window.registerTreeDataProvider("gitBranchesView", gitBranchProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "gitBranchesView.checkoutBranch",
      (branchName: string) => {
        gitBranchProvider.checkoutBranch(branchName);
      }
    )
  );
}

class GitBranchTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | void
  > = new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor() {}

  getChildren(element?: TreeItem): vscode.ProviderResult<TreeItem[]> {
    if (element) {
      return undefined;
    } else {
      return this.getGitBranches();
    }
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  private getGitBranches(): Promise<TreeItem[]> {
    return new Promise((resolve, reject) => {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found!");
        reject("No workspace folder found");
        return;
      }

      cp.exec("git branch", { cwd: workspaceFolder }, (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Error fetching Git branches: ${stderr}`
          );
          reject(stderr);
          return;
        }

        const branches = stdout
          .split("\n")
          .filter((branch) => branch.trim() !== "")
          .map((branch) => new TreeItem(branch.trim()));

        resolve(branches);
      });
    });
  }

  checkoutBranch(branchName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec(
      `git checkout ${branchName}`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to checkout branch: ${stderr}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Checked out to branch: ${branchName}`
        );
        this._onDidChangeTreeData.fire();
      }
    );
  }
}

class TreeItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "branch";

    this.command = {
      command: "gitBranchesView.checkoutBranch",
      title: "Checkout Branch",
      arguments: [label],
    };
  }
}
