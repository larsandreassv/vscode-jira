import * as vscode from "vscode";
import * as cp from "child_process";
import { deflate } from "zlib";

export function activate(context: vscode.ExtensionContext) {
  const gitBranchProvider = new GitBranchTreeDataProvider();
  vscode.window.registerTreeDataProvider("gitBranchesView", gitBranchProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("gitBranchesView.addBranch", () => {
      gitBranchProvider.createBranchFromDefault();
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
      (branch: TreeItem) => {
        gitBranchProvider.deleteLocalBranch(branch);
      }
    ),
    vscode.commands.registerCommand(
      "gitBranchesView.pullFromDefault",
      (branch: TreeItem) => {
        gitBranchProvider.pullFromDefeult(branch);
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

  constructor() { }

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

  createBranchFromDefault() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec("git branch", { cwd: workspaceFolder }, async (err, stdout, stderr) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Error checking for branches: ${stderr}`
        );
        return;
      }

      const defaultBranchName = await getDefaultBranch();
      const hasDefaultBranch = defaultBranchName && stdout.includes(defaultBranchName);

      if (!hasDefaultBranch) {
        vscode.window.showErrorMessage(
          `No ${defaultBranchName} branch found. Cannot base a new branch on it.`
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
            `git checkout ${defaultBranchName} && git checkout -b ${branchName}`,
            { cwd: workspaceFolder },
            (err, stdout, stderr) => {
              if (err) {
                vscode.window.showErrorMessage(
                  `Failed to create branch: ${stderr}`
                );
                return;
              }

              vscode.window.showInformationMessage(
                `Branch '${branchName}' created based on '${defaultBranchName}'`
              );
              this._onDidChangeTreeData.fire();
            }
          );
        });
    });
  }

  checkoutLocalBranch(branchName: string) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    getDefaultBranch();

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

  deleteLocalBranch(branch: TreeItem) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    vscode.window
      .showInformationMessage(`Are you sure you want to delete branch ${branch.label}?`, "Yes", "No")
      .then(answer => {
        if (answer === "Yes") {
          cp.exec(
            `git branch -d ${branch.label}`,
            { cwd: workspaceFolder },
            (err, stdout, stderr) => {
              if (err) {
                vscode.window.showErrorMessage(
                  `Failed to delete local branch: ${stderr}`
                );
                return;
              }

              vscode.window.showInformationMessage(
                `Local branch: ${branch.label} deleted`
              );
              this._onDidChangeTreeData.fire();
            }
          );
        }
      }
      );
  }

  pullFromDefeult(branch: TreeItem) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    let currentBranch = "";
    let branchToMerge = String(branch.label).replace('*', '').trim();
    const defaultBranchName = getDefaultBranch();

    cp.exec(
      `git branch --show-current`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to get current branch name: ${stderr}`
          );
          return;
        }

        currentBranch = stdout.trim();
      });


    if (currentBranch !== branchToMerge) {
      this.checkoutLocalBranch(String(branch.label));
    }

    cp.exec(
      `git merge ${defaultBranchName}`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to merge ${defaultBranchName} to local branch: ${stderr}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Merged ${defaultBranchName} to local branch: ${branch.label}`
        );
        this._onDidChangeTreeData.fire();
      }
    );
  }
}

function getDefaultBranch(): Promise<string> {
  return new Promise((resolve, reject) => {

    let defaultBranch = "";
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder found!");
      return;
    }

    cp.exec(
      `git ls-remote --symref origin HEAD`,
      { cwd: workspaceFolder },
      (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to get default branch: ${stderr}`
          );
          return;
        }

        defaultBranch = stdout.split(/[\/\s]+/).filter(Boolean)[3].trim();
        resolve(defaultBranch);
      });
  });
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