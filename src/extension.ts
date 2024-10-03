import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
   let disposable = vscode.commands.registerCommand('extension.showList', () => {
      const panel = vscode.window.createWebviewPanel(
         'listView', 
         'List with Buttons', 
         vscode.ViewColumn.One, 
         {}
      );

      // Define the list of strings
      const strings = ['Item 1', 'Item 2', 'Item 3'];

      // Generate HTML for the Webview
      panel.webview.html = getWebviewContent(strings);
   });

   context.subscriptions.push(disposable);
}

function getWebviewContent(strings: string[]): string {
   // Dynamically create buttons for each string in the list
   const itemsHtml = strings.map((item, index) => `
      <div>
         <span>${item}</span>
         <button onclick="handleClick(${index})">Click me</button>
      </div>
   `).join('');

   // Return HTML content with simple JavaScript to handle button clicks
   return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
         <meta charset="UTF-8">
         <meta name="viewport" content="width=device-width, initial-scale=1.0">
         <title>List with Buttons</title>
      </head>
      <body>
         <h1>List of Items</h1>
         ${itemsHtml}
         <script>
            const vscode = acquireVsCodeApi();

            function handleClick(index) {
               vscode.postMessage({ command: 'buttonClick', index });
            }
         </script>
      </body>
      </html>
   `;
}

export function deactivate() {}
