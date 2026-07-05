# Claude Data Recovery Web 使用教程

这个目录是网页版入口。它可以直接在浏览器里使用，不需要安装 Python，也不需要运行命令。

## 在线使用

如果仓库开启了 GitHub Pages，直接打开：

```text
https://easoncksd.github.io/claude-data-recovery/web/generator.html
```

使用步骤：

1. 点击 `选择 Claude 导出文件`
2. 选择 Claude 官方导出的 `.zip` 文件
3. 点击 `生成恢复包`
4. 在下方预览恢复页面
5. 点击 `新窗口打开`，进入完整的恢复页面

## 本地使用

也可以下载仓库后离线使用：

1. 在 GitHub 仓库页面点击 `Code`
2. 点击 `Download ZIP`
3. 解压下载的项目
4. 打开 `web/generator.html`
5. 选择自己的 Claude 导出 `.zip`
6. 点击 `生成恢复包`
7. 点击 `新窗口打开`

## 页面功能

- 搜索标题、正文、附件内容
- 按类型、分类、优先级筛选对话
- 查看完整对话内容
- 打开单条对话的 Markdown 文本
- 复制对话 UUID
- 查看找回与申诉说明
- 打开或复制记忆导入文本

## 隐私说明

所有解析都在浏览器本地完成。用户选择的 Claude 导出文件不会上传到 GitHub，也不会上传到服务器。

请不要把自己的 Claude 导出 `.zip`、生成后的恢复页面、Markdown 文件或 JSON 数据提交到 GitHub。

## English

This folder contains a static, local-only browser generator.

Open `index.html` or `generator.html`, select a Claude export `.zip` or an extracted Claude data export folder that contains `conversations.json`, then generate a local preview. Use `Open in new window` to work with the generated offline viewer in a full browser tab.

The generated viewer keeps the original recovery UI. User data is parsed in the browser and is not uploaded.
