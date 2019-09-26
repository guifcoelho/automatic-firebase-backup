const axios = require('axios');
const dateformat = require('dateformat');
const express = require('express');
const { google } = require('googleapis');

const app = express();

// Trigger a backup
app.get('/cloud-firestore-export', async (req, res) => {

    if(req.get('X-Appengine-Cron') !== 'true') {
        console.warn('Cron called outside of App Engine');
        return res.status(403).send('Cron called outside of App Engine').end()
    };

    const auth = await google.auth.getClient({
        scopes: ['https://www.googleapis.com/auth/datastore']
    });

    const accessTokenResponse = await auth.getAccessToken();
    const accessToken = accessTokenResponse.token;
    const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
    };

    // Construct a backup path folder based on the timestamp
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const url = `https://firestore.googleapis.com/v1beta1/projects/${projectId}/databases/(default):exportDocuments`;

    const timestamp = dateformat(Date.now(), 'yyyy-mm-dd-HH-MM-ss');
    const path = [
        `gs://${projectId}.appspot.com/automatic-firestore-backup/${timestamp}/all`,
        `gs://${projectId}.appspot.com/automatic-firestore-backup/${timestamp}/per_collection`
    ];
    const body = path.map(el => { return {outputUriPrefix: el} });

    // If specified, mark specific collections for backup
    const collectionParam = req.param('collections');
    const collectionIds = collectionParam ? collectionParam.split(',') : null;

    try {
        const [respAll, respPerColl] = await Promise.all([
            axios.post(url, body[0], { headers: headers }),
            collectionIds ? axios.post(url, {...body[1], collectionIds}, { headers: headers }) : null
        ]);

        const responseBody = JSON.stringify([respAll.data, respPerColl.data]);
        return res.status(200).send(responseBody).end();
        
    } catch (e) {
        if (e.response) {
            console.warn(e.response.data);
        }

        return res.status(500).send('Could not start backup: ' + e).end();
    }
});

// Index page, just to make it easy to see if the app is working.
app.get('/', (req, res) => {
    res.status(200).send('[automatic-firestore-backup]: Hello, world!').end();
});

// Start the server
const PORT = process.env.PORT || 6060;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});