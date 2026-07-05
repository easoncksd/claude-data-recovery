# Claude Data Recovery Web 使用教程

这个目录是网页版入口。用户下载仓库后，可以直接用浏览器打开，不需要安装 Python，也不需要运行命令。

## 怎么使用

1. 打开 GitHub 仓库页面
2. 点击绿色 `Code`
3. 点击 `Download ZIP`
4. 解压下载下来的项目
5. 打开 `web/generator.html`
6. 点击 `选择 Claude 导出文件`
7. 选择 Claude 官方导出的 `.zip` 文件
8. 点击 `生成恢复包`
9. 点击 `新窗口打开`，进入完整的恢复页面

## 页面功能

- 搜索标题、正文、附件内容
- 按类型、分类、优先级筛选对话
- 查看完整对话内容
- 打开单条对话的 Markdown 文本
- 复制对话 UUID
- 查看找回与申诉说明
- 打开或复制记忆导入文本

## 隐私说明

所有解析都在用户自己的浏览器本地完成。用户选择的 Claude 导出文件不会上传到 GitHub，也不会上传到服务器。

请不要把自己的 Claude 导出 `.zip`、生成后的恢复页面、Markdown 文件或 JSON 数据提交到 GitHub。

## English

This folder contains the browser-based local generator.

Download the repository, open `web/generator.html`, select the official Claude export `.zip`, and generate a local recovery viewer. The export is parsed in the browser and is not uploaded.
