// This code use "Code by Zapier" to create a new post with an embed.
// As input you need :
// * username : Your bluesky username (xyz.bsky.social)
// * password : Create one here https://bsky.app/settings/app-passwords
// * post_text : Your post text
// * post_url : Your post url
// * embed_title : Title of the embed
// * embed_description : Description of the embed
// * embed_picture : Picture used in the embed


const BASE_URL = 'https://bsky.social/xrpc';

async function postRequest(url, data, headers = {}) {
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json', ...headers },
        redirect: 'manual'
    });
    if (!response.ok) {
        console.error('Failed request', await response.text());
        return null;
    }
    return response.json();
}

async function uploadPicture(url, pictureBuffer, authToken) {
    const response = await fetch(url, {
        method: 'POST',
        body: pictureBuffer,
        headers: {
            'Content-Type': 'image/jpeg',
            'Authorization': `Bearer ${authToken}`
        }
    });
    if (!response.ok) {
        console.error('Failed to upload the image:', await response.text());
        return null;
    }
    return response.json();
}

async function createSession(username, password) {
    const sessionData = { identifier: username, password };
    return await postRequest(`${BASE_URL}/com.atproto.server.createSession`, sessionData);
}

async function createPost(authToken, recordData) {
    return await postRequest(
        `${BASE_URL}/com.atproto.repo.createRecord`,
        { repo: inputData['username'], collection: 'app.bsky.feed.post', record: recordData },
        { 'Authorization': `Bearer ${authToken}` }
    );
}

const username = inputData['username'];
const password = inputData['password'];
const postText = `${inputData['post_text']} ${inputData['post_url']}`;
const postURL = inputData['post_url'];

try {
    // Create a session and obtain the access token
    const sessionResponse = await createSession(username, password);
    if (!sessionResponse || !sessionResponse.accessJwt) {
        throw new Error('accessJwt not found in the session response');
    }
    const authToken = sessionResponse.accessJwt;

    // Calculate link positions in text
    const byteStart = Buffer.from(postText.slice(0, postText.indexOf(postURL))).length;
    const byteEnd = byteStart + Buffer.from(postURL).length;

    // Download picture
    const pictureResponse = await fetch(inputData['embed_picture']);
    if (!pictureResponse.ok) {
        const errorText = await pictureResponse.text();
        throw new Error(`Failed to fetch the image: ${errorText}`);
    }
    const pictureBuffer = await pictureResponse.buffer();

    // Upload picture
    const blobResponseData = await uploadPicture(`${BASE_URL}/com.atproto.repo.uploadBlob`, pictureBuffer, authToken);
    if (!blobResponseData || !blobResponseData.blob) {
        throw new Error('Failed to upload the picture');
    }

    // Create post data
    const recordData = {
        "$type": "app.bsky.feed.post",
        "text": postText,
        "createdAt": new Date().toISOString(),
        embed: {
            $type: 'app.bsky.embed.external',
            external: {
                uri: postURL,
                title: inputData['embed_title'],
                description: inputData['embed_description'],
                thumb: blobResponseData.blob
            }
        },
        "facets": [
            {
                "index": { "byteStart": byteStart, "byteEnd": byteEnd },
                "features": [
                    {
                        "$type": "app.bsky.richtext.facet#link",
                        "uri": postURL
                    }
                ]
            }
        ]
    };

    // Create the post
    const postResponse = await createPost(authToken, recordData);
    if (!postResponse) {
        throw new Error('Failed to create the post');
    }

    // Return success infos
    output = { success: true, body: postResponse };

} catch (error) {
    console.error(error);
    output = { success: false, message: error.message };
}