

var express = require('express')
var googleAux = require('googleapis')
var fs = require('fs')

const envFound = require('dotenv').config();
const google = googleAux.google
const OAuth2 = google.auth.OAuth2
const youtube = google.youtube({ version: 'v3' })
const readline = require('readline')

const googleYoutubeJSON = process.env.YOUTUBEJSON
const finalVideoFolder = process.env.FINALVIDEOFOLDER

// Faz o upload do video para o youtube
async function uploadYoutube(finalVideoName, postList, fileList, subReddit) {
    await oAuth()
    const videoFilePath = finalVideoFolder + finalVideoName
    const videoFileSize = fs.statSync(videoFilePath).size
    const playlistIdValue = await getPlaylistBySubReddit(subReddit)
    console.log(playlistIdValue)
    const videoDescription = await descriptionGenerator(subReddit, postList, fileList.split('\n'))
    const videoTitle = await titleGenerator()
    const videoTags = await tagsGenerator()

    try {
        const requestParameters = {
            part: 'snippet, status',
            requestBody: {
                snippet: {
                    title: videoTitle,
                    description: videoDescription,
                    tags: videoTags,
                    categoryId: 2
                },
                status: {
                    privacyStatus: 'public'
                }
            },
            media: {
                body: fs.createReadStream(videoFilePath)
            }
        }

        // faz o print do progresso no upload (%) em tempo real
        console.log('> [youtube-uploader] Starting to upload the video to YouTube')
        const youtubeResponse = await youtube.videos.insert(requestParameters, {
            onUploadProgress: onUploadProgress
        })
        function onUploadProgress(event) {
            const progress = Math.round((event.bytesRead / videoFileSize) * 100)
            console.log(`> [youtube-uploader] ${progress}% completed`)
        }
        console.log(`> [youtube-uploader] Video available at: https://youtu.be/${youtubeResponse.data.id}`)

        // insere o video na playlist correspondente
        await insertInPlaylist(playlistIdValue, youtubeResponse.data.id)

        return youtubeResponse.data
    } catch (err) {
        console.log(err)
    }
}

// gere o oAuth
async function oAuth() {

    const webServer = await startWebServer()
    const OAuthClient = await createOAuthClient()
    requestUserConsent(OAuthClient)
    const authorizationToken = await waitForGoogleCallback(webServer)
    await requestGoogleForAccessTokens(OAuthClient, authorizationToken)
    setGlobalGoogleAuthentication(OAuthClient)
    await stopWebServer(webServer)
}

// começa um servidor web
async function startWebServer() {
    return new Promise((resolve) => {
        const port = 5000
        const app = express()

        const server = app.listen(port, () => {
            console.log('> [youtube-uploader] Listening on http://localhost:'+port)

            resolve({
                app,
                server
            })
        })
    })
}

// cria o cliente oAuth
async function createOAuthClient() {
    let credentials = JSON.parse(fs.readFileSync(googleYoutubeJSON, 'utf-8'))

    const OAuthClient = new OAuth2(
        credentials.web.client_id,
        credentials.web.client_secret,
        credentials.web.redirect_uris[0]
    )

    return OAuthClient
}

// pede o consentimento ao usuário
function requestUserConsent(OAuthClient) {
    const consentUrl = OAuthClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube']
    })

    console.log('> [youtube-uploader] Please give your consent: '+consentUrl)
}

// aguarda pelo consimento do usuário
async function waitForGoogleCallback(webServer) {
    return new Promise((resolve) => {
        console.log('> [youtube-uploader] Waiting for user consent...')

        webServer.app.get('/oauth2callback', (req, res) => {
            const authCode = req.query.code
            console.log('> [youtube-uploader] Consent given')

            res.send('<h1>Thank you!</h1><p>Now close this tab.</p>')
            resolve(authCode)
        })
    })
}

// pede ao google pelos tokens de acesso
async function requestGoogleForAccessTokens(OAuthClient, authorizationToken) {
    return new Promise((resolve, reject) => {
        OAuthClient.getToken(authorizationToken, (error, tokens) => {
            if (error) {
                return reject(error)
            }

            console.log('> [youtube-uploader] Access tokens received!')

            OAuthClient.setCredentials(tokens)
            resolve()
        })
    })
}

// define a variavel global do valor de autenticação do google
function setGlobalGoogleAuthentication(OAuthClient) {
    google.options({
        auth: OAuthClient
    })
}

// fecha o servidor web criado
async function stopWebServer(webServer) {
    return new Promise((resolve) => {
        webServer.server.close(() => {
            resolve()
        })
    })
}

// gera a descrição do video baseado nos posts incluidos no mesmo, mencionando os seus autores, titulos de posts e URL's originais
async function descriptionGenerator(subReddit, postList, filesList) {
    var description = "#reddit #" + subReddit.split("/")[1] + " #compilation \n\nThis is an automated video made with posts from the subreddit " + subReddit + ". \n\nIf you are the author of one of these videos and " +
        'you want it removed, leave a comment in the comment section. \n\nAll the authors and posts: \n'
    try {
        for (let video of filesList) {
            for (let post of postList) {
                if(video != ''){
                    if (video.split('/')[3].split('with')[0] + '.mp4' === post.videoName) {
                        description += post.title + ' by ' + post.user + ' \nlink: ' + post.url + '\n\n'
                    }

                }
            }
        }
    } catch (err) {
        console.log(err)
    }
    return description

}

// insere as tags no video
async function tagsGenerator() {
    let tags = 'reddit, best of reddit, funny, automated channel, viral, Best, fail, win'
    return tags.split(', ')
}

// Pede o titulo do video ao utilizador
async function titleGenerator() {
    const r2 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return await new Promise((resolve, reject) => {
        r2.question("Insert the title for the video\n", ans => {
            r2.close()
            resolve(ans)
        })
    })
}


// insere o video numa playList
async function insertInPlaylist(playListIdValue, videoIdValue) {
    try {
        var responseUpdate = await youtube.playlistItems.insert({
            part: 'snippet',
            resource: {
                snippet: {
                    playlistId: playListIdValue,
                    resourceId: {
                        videoId: videoIdValue,
                        kind: "youtube#video"
                    }
                }
            }
        })
        return responseUpdate
    } catch (err) {
        console.log(err)
    }
}

// Obtem a playlist de acordo com o subreddit usado
async function getPlaylistBySubReddit(subReddit) {
    playlistName = "Best of " + subReddit
    var responsePlaylists = await youtube.playlists.list({
        part: 'snippet',
        mine: true
    })
    for (let playlist of responsePlaylists.data.items) {
        if (playlist.snippet.title == playlistName) {
            return playlist.id
        }
    }
    return createPlaylist(playlistName, subReddit)
}

// Cria uma playlist
async function createPlaylist(playlistName, subReddit) {
    var newPlaylist = await youtube.playlists.insert({
        part: 'snippet, status',
        resource: {
            snippet: {
                title: playlistName,
                description: 'The best posts of the subReddit ' + subReddit
            },
            status: {
                privacyStatus: 'public'
            }
        }
    })
    return newPlaylist.data.id

}

module.exports.uploadYoutube = uploadYoutube