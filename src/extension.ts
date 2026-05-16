import * as vscode from 'vscode';
import { CanvasPanel } from './CanvasPanel';
import { NodeSidebarProvider } from './NodeSidebarProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "etl-code" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('etl-code.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from etl-code!');
	});

	const canvasCommand = vscode.commands.registerCommand('etl-code.openCanvas', () => {
		CanvasPanel.createOrShow(context.extensionUri);
		vscode.commands.executeCommand('etl-code.nodeSidebar.focus');
	});

	const sidebarProvider = new NodeSidebarProvider(context.extensionUri);
	const sidebarRegistration = vscode.window.registerWebviewViewProvider(
		NodeSidebarProvider.viewType,
		sidebarProvider
	);

	context.subscriptions.push(disposable, canvasCommand, sidebarRegistration);
}

// This method is called when your extension is deactivated
export function deactivate() {}
