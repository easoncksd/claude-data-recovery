# Claude Data Recovery Web

This folder contains a static, local-only browser generator.

Open `index.html` or `generator.html`, select a Claude export `.zip` or an
extracted Claude data export folder that contains `conversations.json`, then
generate a local preview. Use `Open in new window` to work with the generated
offline viewer in a full browser tab.

The generated viewer keeps the original recovery UI. User data is parsed in the
browser and is not uploaded.

Current scope:

- Supports Claude export `.zip` files and `conversations.json`
- Optionally reads `memories.json`, `users.json`, and `projects/*.json`
- Generates `index.html`, `normalized_data.json`, Markdown files, and recovery notes
