# Codegen — Recording Playwright Scripts

This guide explains how to use the **Codegen** feature to record and manage Playwright automation scripts from the UI Police dashboard.

---

## What is Codegen?

Codegen opens a **headed Playwright browser** pointed at one of the configured environments (e.g. `develop` or `local`). You interact with the app normally — click, type, navigate — and Playwright records every action as executable JavaScript/TypeScript code. When you close the browser, the recorded script is saved and can be replayed later.

---

## Quick Start

### From the Dashboard (`bun run ui`)

1. Open the dashboard at `http://localhost:3737`
2. Select the **Application** (e.g. `auth`, `plan`, `coach`)
3. Select the **Environment** (e.g. `DEVELOP`, `LOCAL`)
4. Click **Codegen** — a browser window opens
5. Interact with the app (login, click, fill forms, navigate)
6. **Close the browser** when done — the script is auto-saved
7. The script appears in the **Recorded Scripts** sidebar

### From the CLI

```bash
bun run codegen
```

Follow the prompts to select the app and environment.

---

## Managing Scripts

### Creating a Script Manually

If you already have a Playwright script (from codegen output, or written by hand):

1. Click **New Script** in the dashboard
2. Select the **Application** it belongs to
3. Give it a **name** (e.g. `registration-flow`)
4. Add a **description** (e.g. `User registration and onboarding test`)
5. Paste the Playwright code into the **code editor**
6. Click **Save Script**

### Example Script (from Codegen Output)

```ts
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://dev-plan.cariloop.com/login');
  await page.getByRole('link', { name: 'Sign up' }).click();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('textbox', { name: 'First name' }).fill('Fred 03');
  await page.getByRole('textbox', { name: 'Last name' }).fill('Test Lastname');
  await page.getByRole('textbox', { name: 'Email address' }).fill('test@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('Ca.123123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await context.close();
  await browser.close();
})();
```

### Editing a Script

1. In the **Recorded Scripts** sidebar, click the **pencil icon** on any script
2. The editor opens with the current code pre-loaded
3. Modify the code, description, or **change the Application** to move it
4. Click **Save Script**

### Moving a Script to Another App

If you recorded a script under the wrong app:

1. Click the **pencil icon** to edit the script
2. Change the **Application** dropdown to the correct app
3. Click **Save Script** — the script is moved automatically

### Deleting a Script

- Click the **trash icon** on any script in the sidebar, or
- Open the editor and click **Delete**

### Running a Script

- Click the **play icon** on any script in the sidebar
- The script runs via `bun run` and output streams to the terminal

---

## Where Scripts Are Stored

Scripts are saved to:

```
output/captures/scripts/{app}/{script-name}.ts
```

Each app has a `registry.json` that indexes all scripts:

```
output/captures/scripts/{app}/registry.json
```

---

## Auto-Execution During Pipeline

When you run the **Full Pipeline** or **Capture**, all registered scripts for the selected app are automatically executed after page screenshots are taken. This allows you to:

1. Capture the default page states
2. Run your recorded flows (login, signup, interactions)
3. Take additional screenshots during those flows

---

## Stopping a Recording

If you started Codegen and want to cancel:

- Click the **End Capture** button (the Codegen button turns red while recording)
- Or simply close the browser window

---

## Tips

- **Name scripts clearly** — use descriptive names like `login-flow`, `registration-happy-path`, `admin-user-management`
- **One flow per script** — keep scripts focused on a single user flow
- **Test before saving** — run a script once after saving to verify it works
- **Environment matters** — scripts record URLs from the selected environment; make sure the flow works on the target env
- **Codegen output is raw JS** — you can save it as-is or clean it up before saving
