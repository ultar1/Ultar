# Ultar-MD

A multi-device WhatsApp bot built with Baileys.

## Deployment

Deploy your own instance of Ultar-MD to Render in just a few clicks.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ultar1/Ultarbug)

### Setup Instructions

1.  **Deploy the App:** Click the "Deploy to Render" button above. You will be asked to give your project a name.

2.  **Create a Database:**
    * While the app is deploying, go to the Render Dashboard, click **New +**, and select **PostgreSQL**.
    * Follow the steps to create a new database. Use the **Free** plan.
    * Once the database is ready, go to its "Info" page and copy the **Internal Database URL**.

3.  **Add Database URL:**
    * Go back to your deployed bot service on Render.
    * Go to the **Environment** tab.
    * Click **Add Environment Variable**.
    * For the **Key**, enter `DATABASE_URL`.
    * For the **Value**, paste the Internal Database URL you copied.
    * Click **Save Changes**. This will trigger a new deployment.

4.  **Pair Your WhatsApp Account:**
    * Wait for the deployment to finish.
    * Go to the **Shell** tab of your bot service.
    * In the command line at the bottom, type `npm run pair` and press Enter.
    * The script will ask for your WhatsApp number. Type it in (with country code) and press Enter.
    * A **Pairing Code** will be printed in the shell.
    * Open WhatsApp on your phone, go to **Settings > Linked Devices**, and choose "Link with phone number" to enter the code.

5.  **Restart the Bot:**
    * Once pairing is complete, go to the top of your service page on Render and click **Manual Deploy > Restart service**.

Your bot is now deployed and connected to your WhatsApp account!
