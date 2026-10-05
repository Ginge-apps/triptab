# Trip Tab setup

About 30 minutes, once. Everything here is on free plans except the Claude usage for reading receipts, which runs a cent or two per receipt.

You will set up four things:

1. GitHub Pages hosts the app and gives you its web address.
2. Firebase keeps everyone's phones in sync.
3. An Anthropic API key lets Claude read receipts and pasted text.
4. A Cloudflare Worker holds that key so it never sits on anyone's phone.

Until steps 2 to 4 are done, the app still works on your phone alone. Import and manual entry work without any of them.

---

## 1. Host the app (GitHub Pages)

1. Create a free account at github.com if you don't have one.
2. Top right, click **+** then **New repository**. Name it `triptab`. Leave it **Public**. Click **Create repository**.
3. On the new repo page, click **uploading an existing file**. Drag in every file from the Trip Tab folder, including the `icons` folder. Click **Commit changes**.
4. Go to **Settings > Pages**. Under Source pick **Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
5. After a minute the page shows your address, something like `https://yourname.github.io/triptab/`. Write it down.

## 2. Turn on sync (Firebase)

1. Go to console.firebase.google.com and sign in with a Google account. Click **Create a project**, name it `triptab`, and turn Google Analytics off.
2. Left menu, **Build > Authentication > Get started**. Under Sign-in method, choose **Anonymous** and turn it on. Save.
3. Still in Authentication, open **Settings > Authorized domains > Add domain** and add `yourname.github.io`.
4. **Build > Firestore Database > Create database**. Pick a location near you (`nam5` for the US, `eur3` for Europe). Start in **production mode**.
5. Open the **Rules** tab, delete what is there, paste the contents of `firestore.rules`, and click **Publish**.
6. Click the gear icon next to Project Overview, then **Project settings**. Under Your apps click the web icon `</>`, name it `triptab`, skip hosting, and click **Register app**.
7. You will see a block called `firebaseConfig`. Keep that page open for step 5.

## 3. Get a Claude API key

1. Go to console.anthropic.com and sign in.
2. **Billing**: add $10 to $20 of credit. Set a monthly spend limit you are comfortable with.
3. **API keys > Create key**. Name it `triptab`. Copy the key (starts with `sk-ant-`). You only see it once.

## 4. Set up the relay (Cloudflare Worker)

1. Create a free account at dash.cloudflare.com.
2. **Workers & Pages > Create > Create Worker**. Name it `triptab-claude`. Click **Deploy**.
3. Click **Edit code**. Delete the sample code, paste all of `worker.js`, and click **Deploy**.
4. Go back to the worker, open **Settings > Variables and Secrets**, and add:
   - `ANTHROPIC_API_KEY` as type **Secret**: your key from step 3
   - `APP_KEY` as type **Secret**: any long phrase you make up, like `lisbon-charter-tips-2026`
   - `ALLOWED_ORIGIN` as type **Text**: `https://yourname.github.io` (no trailing slash, no `/triptab`)
5. Copy the worker's address from the top of its page, something like `https://triptab-claude.yourname.workers.dev`.

## 5. Connect the pieces

1. In your GitHub repo, click `config.js`, then the pencil icon to edit.
2. Fill in the six Firebase values from step 2.7, the worker address as `claudeProxy`, and your made-up phrase as `appKey`.
3. Click **Commit changes**. Wait a minute for the site to update.

## 6. Put it on your Home Screen

**iPhone:** open your app address in Safari, tap Share, then **Add to Home Screen**. Open Trip Tab from the icon from then on. Trips you join in Safari stay in Safari, so always use the icon.

**Android:** open the address in Chrome, tap the menu, then **Install app**.

Then tap **Import spreadsheet** to load Stockholm 2023, or **Start a trip**.

## Inviting the crew

Open a trip and tap the people icon at the top. Share the link, or let people scan the QR code at the table. On iPhone they add the app to their Home Screen first, open it, tap **Join with code**, and type the 6-letter code. Then they tap their own name.

Anyone in the trip can add expenses. Only the person who added an expense, or the trip organizer, can edit or delete it.

## Updating the app later

Replace `index.html` in the GitHub repo with a new version and commit. Phones pick it up the next time the app opens with a connection.
