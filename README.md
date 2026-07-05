# Claude Data Recovery

Turn an official Claude data export into a private, searchable offline viewer and a portable Markdown archive.

Claude Data Recovery runs locally, uses only the Python standard library, and never uploads your conversations.

> [!IMPORTANT]
> Claude exports can contain private conversations, account details, memories, and extracted attachment text. Never commit your export or generated recovery output to GitHub.

## Browser generator

This repository also includes an experimental static browser generator in `web/`.
It keeps the generated offline viewer separate from the import UI, so the existing
viewer layout is not replaced.

Open `web/index.html` or `web/generator.html` in a browser, choose the official
Claude export `.zip` file, then generate the local recovery viewer. You can also
choose an already-extracted export folder that contains `conversations.json`.

All parsing happens in the browser. The export is not uploaded.

## 中文网页使用教程

这个仓库现在可以直接当作网页工具使用，不需要安装 Python，也不需要运行命令。

### 方法一：直接打开网页链接

如果仓库开启了 GitHub Pages，用户只需要打开这个链接：

```text
https://easoncksd.github.io/claude-data-recovery/web/generator.html
```

然后按下面步骤操作：

1. 点击 `选择 Claude 导出文件`
2. 选择 Claude 官方导出的 `.zip` 文件
3. 点击 `生成恢复包`
4. 在下方预览生成的恢复页面
5. 点击 `新窗口打开`，在完整页面里搜索和查看对话

整个解析过程都在用户自己的浏览器里完成，Claude 导出数据不会上传到 GitHub，也不会上传到服务器。

### 方法二：下载到本地使用

如果没有开启 GitHub Pages，或者用户更想离线使用，可以这样做：

1. 打开 GitHub 仓库页面
2. 点击绿色 `Code`
3. 点击 `Download ZIP`
4. 解压下载下来的项目
5. 打开 `web/generator.html`
6. 选择自己的 Claude 导出 `.zip`
7. 点击 `生成恢复包`
8. 点击 `新窗口打开`

### 生成后的页面能做什么

- 搜索标题、正文、附件内容
- 按对话类型筛选
- 按主题分类筛选
- 按优先级筛选
- 查看完整对话内容
- 打开单条对话的 Markdown 文本
- 复制对话 UUID
- 查看找回与申诉说明
- 打开或复制记忆导入文本

### 重要提醒

Claude 导出的 `.zip` 里面可能包含私人聊天、账号信息、记忆内容和附件文本。不要把自己的 Claude 导出文件上传到 GitHub，也不要把生成后的恢复页面公开分享。

## 中文命令行快速开始

这个工具也保留了原来的命令行方式。它会在本地解析 Claude 官方数据导出，生成可搜索的离线网页、逐条对话 Markdown、记忆导入文本和项目恢复资料。整个过程不会上传数据。

```bash
claude-data-recovery "/你的/Claude导出文件夹" -o "./恢复结果"
```

生成后，直接用浏览器打开 `恢复结果/index.html`。
## Output structure

```text
claude-recovery-output/
|-- index.html
|-- normalized_data.json
|-- README_RECOVERY.md
|-- memory_import.md
|-- project_recovery.md
|-- account_appeal.md
`-- markdown/
    `-- 2026-01-01_001_example_conversation_ab12cd34.md
```

## Privacy design

- No network requests
- No analytics or tracking
- No API keys
- No third-party Python dependencies
- Text is rendered safely instead of injecting exported HTML
- Common export filenames are excluded by `.gitignore`

The generated `index.html` embeds your recovered data so it can be opened offline. Treat that file as sensitive.

## Known limitations

- Anthropic does not publish a stable schema for every export field, so parsing is best-effort.
- Exported data cannot recreate the original Claude sidebar in another personal account.
- Some attachment binaries may not be present; extracted attachment text is preserved when available.
- Very large exports create a correspondingly large single HTML file.

## Development

```bash
python -m unittest discover -s tests -v
python -m claude_data_recovery tests/fixtures/sample_export -o /tmp/claude-recovery-demo
```

The test fixture is synthetic and contains no real user data.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Please never attach a real Claude export to an issue; provide a minimal synthetic fixture instead.

## Security

For privacy or security problems, follow [SECURITY.md](SECURITY.md). Do not disclose conversation exports in public issues.

## License

[MIT](LICENSE)

## Disclaimer

Claude Data Recovery is an independent community project by MindLeap AI Labs. It is not affiliated with, endorsed by, or sponsored by Anthropic. Claude and Anthropic are trademarks of Anthropic PBC.
