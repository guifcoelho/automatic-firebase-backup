const axios = require('axios');
const dateformat = require('dateformat');
const express = require('express');
const { google } = require('googleapis');

const app = express();

// Trigger a backup
app.get('/cloud-firestore-export', async (req, res) => {
    const auth = await google.auth.getClient({
        scopes: ['https://www.googleapis.com/auth/datastore']
    });

    const accessTokenResponse = await auth.getAccessToken();
    const accessToken = accessTokenResponse.token;

    const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + accessToken
    };

    // const outputUriPrefix = req.param('outputUriPrefix');
    // if (!(outputUriPrefix && outputUriPrefix.indexOf('gs://') == 0)) {
    //     res.status(500).send(`Malformed outputUriPrefix: ${outputUriPrefix}`);
    // }

    // Construct a backup path folder based on the timestamp

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const url = `https://firestore.googleapis.com/v1beta1/projects/${projectId}/databases/(default):exportDocuments`;

    const timestamp = dateformat(Date.now(), 'yyyy-mm-dd-HH-MM-ss');
    const path = [
        `gs://projeto-compras-bd4f9.appspot.com/automatic-firestore-backup/${timestamp}/all`,
        `gs://projeto-compras-bd4f9.appspot.com/automatic-firestore-backup/${timestamp}/per_collection`
    ];
    const body = path.map(el => { return {outputUriPrefix: el} });

    // If specified, mark specific collections for backup
    const collectionParam = req.param('collections');
    const collectionIds = collectionParam ? collectionParam.split(',') : null;

    try {
        const [respAll, respPerColl] = await Promise.all([
            axios.post(url, body[0], { headers: headers }),
            axios.post(url, {...body[1], collectionIds}, { headers: headers })
        ]);

        const responseBody = JSON.stringify([respAll.data, respPerColl.data]);
        res.status(200).send(responseBody).end();
        
    } catch (e) {
        if (e.response) {
            console.warn(e.response.data);
        }

        res.status(500).send('Could not start backup: ' + e).end();
    }
});

// Index page, just to make it easy to see if the app is working.
app.get('/', (req, res) => {
    res.status(200).send('[scheduled-backups]: Hello, world!').end();
});

// Start the server
const PORT = process.env.PORT || 6060;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});