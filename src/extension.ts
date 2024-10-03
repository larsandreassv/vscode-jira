import * as vscode from "vscode";
import * as cp from "child_process";

export function activate(context: vscode.ExtensionContext) {
  const gitBranchProvider = new GitBranchTreeDataProvider();
  vscode.window.registerTreeDataProvider("gitBranchesView", gitBranchProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("gitBranchesView.addBranch", () => {
      gitBranchProvider.createBranchFromDevelop();
    }),
    vscode.commands.registerCommand(
      "gitBranchesView.checkoutLocalBranch",
      (branchName: string) => {
        gitBranchProvider.checkoutLocalBranch(branchName);
      }
    ),
    vscode.commands.registerCommand(
      "gitBranchesView.checkoutRemoteBranch",
      (branchName: string) => {
        gitBranchProvider.checkoutRemoteBranch(branchName);
      }
    ),
    vscode.commands.registerCommand(
      "gitBranchesView.deleteLocalBranch",
      (branchname: string) => {
        gitBranchProvider.deleteLocalBranch(branchname);
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
      return element.children;
    } else {
      return this.getGitBranches();
    }
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  private getGitBranches(): Promise<TreeItem[]> {
    return Promise.all([this.getLocalBranches(), this.getRemoteBranches()])
      .then(([localBranches, remoteBranches]) => {
        if (!localBranches.length && !remoteBranches.length) {
          vscode.window.showInformationMessage(
            "No Git branches found in the current workspace."
          );
        }

        return [
          new TreeItem("Local Branches", localBranches),
          new TreeItem("Remote Branches", remoteBranches),
        ];
      })
      .catch((error) => {
        vscode.window.showErrorMessage(`Failed to load Git branches: ${error}`);
        return [];
      });
  }

  private getLocalBranches(): Promise<TreeItem[]> {
    return this.getBranches("git branch");
  }

  private getRemoteBranches(): Promise<TreeItem[]> {
    return this.getBranches("git branch -r");
  }

  private getBranches(command: string): Promise<TreeItem[]> {
    return new Promise((resolve, reject) => {
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found!");
        reject("No workspace folder found");
        return;
      }

      cp.exec(command, { cwd: workspaceFolder }, (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Error executing ${command}: ${stderr}`
          );
          reject(stderr);
          return;
        }

        const branches = stdout
          .split("\n")
          .filter((branch) => branch.trim() !== "")
          .map(
            (branch) =>
              new TreeItem(
                branch.trim(),
                undefined,
                command === "git branch" ? "local" : "remote"
              )
          );

        resolve(branches);
      });
    });
  }

  createBranchFromDevelop() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec("git branch", { cwd: workspaceFolder }, (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Error checking for develop branch: ${stderr}`
        );
        return;
      }

      const hasDevelopBranch = stdout.includes("develop");

      if (!hasDevelopBranch) {
        vscode.window.showErrorMessage(
          "No 'develop' branch found. Cannot base a new branch on it."
        );
        return;
      }

      vscode.window
        .showInputBox({ prompt: "Enter the new branch name" })
        .then((branchName) => {
          if (!branchName) {
            vscode.window.showErrorMessage("Branch name is required");
            return;
          }

          cp.exec(
            `git checkout develop && git checkout -b ${branchName}`,
            { cwd: workspaceFolder },
            (err, stdout, stderr) => {
              if (err) {
                vscode.window.showErrorMessage(
                  `Failed to create branch: ${stderr}`
                );
                return;
              }

              vscode.window.showInformationMessage(
                `Branch '${branchName}' created based on 'develop'`
              );
              this._onDidChangeTreeData.fire();
            }
          );
        });
    });
  }

  checkoutLocalBranch(branchName: string) {
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
            `Failed to checkout local branch: ${stderr}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Checked out to local branch: ${branchName}`
        );
        this._onDidChangeTreeData.fire();
      }
    );
  }

  checkoutRemoteBranch(branchName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec(
      `git checkout -b ${branchName}`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to checkout remote branch: ${stderr}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Checked out to remote branch: ${branchName}`
        );
        this._onDidChangeTreeData.fire();
      }
    );
  }

  deleteLocalBranch(branchName: string) {
    console.log("Delete!");
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    vscode.window.showInformationMessage("Deleteing branch");

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    // cp.exec(
    //   `git branch -d ${branchName}`,
    //   { cwd: workspaceFolder },
    //   (err, stdout, stderr) => {
    //     if (err) {
    //       vscode.window.showErrorMessage(
    //         `Failed to delete local branch: ${stderr}`
    //       );
    //       return;
    //     }

    //     vscode.window.showInformationMessage(
    //       `Local branch: ${branchName} deleted`
    //     );
    //     this._onDidChangeTreeData.fire();
    //   }
    // );
  }
}

class TreeItem extends vscode.TreeItem {
  children: TreeItem[] | undefined;

  constructor(label: string, children?: TreeItem[], type?: "local" | "remote") {
    super(
      label,
      children === undefined
        ? vscode.TreeItemCollapsibleState.None
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    this.children = children;

    if (!children) {
      this.command = {
        command:
          type === "local"
            ? "gitBranchesView.checkoutLocalBranch"
            : "gitBranchesView.checkoutRemoteBranch",
        title: `Checkout ${type === "local" ? "Local" : "Remote"} Branch`,
        arguments: [label],
      };
      this.contextValue = `${type}-branch`;
    }
  }
}
