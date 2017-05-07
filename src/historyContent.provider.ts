import * as vscode from 'vscode';

import HistoryController  from './history.controller';

import path = require('path');

interface IHistoryContentFile {
    caption: string;
    link: string;
    uri: string;
    isChecked: boolean;
    isCurrent: boolean;
}

export default class HistoryContentProvider implements vscode.TextDocumentContentProvider {

    static scheme = 'local-history';

    // private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    private seq = 0;

    constructor(private controller: HistoryController) {
    }

    // dispose() {
    //     this._onDidChange.dispose();
    // }

    /**
     * Expose an event to signal changes of _virtual_ documents
     * to the editor
     */
    // get onDidChange() {
    //     return this._onDidChange.event;
    // }

    // public update(uri: vscode.Uri) {
    //     this._onDidChange.fire(uri);
    // }

    public showViewer(editor: vscode.TextEditor) {
        const uri = this.encodeEditor(editor);

        return vscode.commands.executeCommand('vscode.previewHtml', uri, Math.min(editor.viewColumn + 1, 3), 'Local history')
            .then(
                (success) => {
            },  (reason) => {
                vscode.window.showErrorMessage(reason);
            });
    }

    public compare(file1, file2: vscode.Uri, column: string) {
        if (file1 && file2)
            this.controller.compare(file1, file2, column);
        else
            vscode.window.showErrorMessage('Select 2 history files to compare');
    }

    /**
     * Provider method that takes an uri of the scheme and
     * resolves its content by creating the html document
     */
    public provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
        const [filename, column] = this.decodeEditor(uri);

        return new Promise((resolve, reject) => {

            // TODO nolimit = true
            this.controller.findAllHistory(filename)
                .then(files => {

                    if (!files || !files.length) {
                        return resolve ('No history');
                    }

                    let contentFiles = [];
                    contentFiles = contentFiles.concat(this.buildContentFiles(filename, column, filename));
                    contentFiles = contentFiles.concat(this.buildContentFiles(files, column, filename));

                    // __dirname = out/src
                    const dirname = path.join(__dirname, '../../preview');

                    const jade = require('jade');
                    jade.renderFile(path.join(dirname, 'history.jade'), {
                        baseDir: path.join(dirname,'/'),
                        currentFile: filename,
                        column: column,
                        compare: encodeURI('command:local-history.compare?'),
                        files: contentFiles
                    }, function(err, html) {
                        if (err) {
                            console.log(err);
                            return reject(err);
                        }
                        return resolve(html);
                    });
                });
        });
    }

    private buildContentFiles(files, column, current: string): IHistoryContentFile[] {
        let properties;

        if (!(files instanceof Array)) {
            properties = this.controller.decodeFile(files, false);
            return [this.getContentFile(vscode.Uri.file(properties.file), column, properties.name + properties.ext, current === properties.file, true)];
        } else {
            let result = [];

            // desc order history
            for (let index = files.length - 1, file; index >= 0; index--) {
                file = files[index].replace(/\//g, path.sep);
                properties = this.controller.decodeFile(file);
                result.push(this.getContentFile(vscode.Uri.file(properties.file), column, properties.date.toLocaleString(), current === properties.file));
            }
            return result;
        }
    }

    private getContentFile(file, column, caption, checked, current?: boolean): IHistoryContentFile {
        return {
            caption: caption,
            link: encodeURI(`command:vscode.open?${JSON.stringify([file, column])}`),
            uri: encodeURI(JSON.stringify(file)),
            isChecked: checked,
            isCurrent: current
        };
    }

    private encodeEditor(editor: vscode.TextEditor): vscode.Uri {
        const query = JSON.stringify([editor.document.fileName, editor.viewColumn]);
        return vscode.Uri.parse(`${HistoryContentProvider.scheme}:Viewer.local-history?${query}#${this.seq++}`);
    }
    private decodeEditor(uri: vscode.Uri): [string, number] {
        let [filename, column] = <[string, number]>JSON.parse(uri.query);
        return [filename, column];
    }

}
