var fetch = require('cross-fetch')
var fs = require('fs')
var https = require('https')
const envFound = require('dotenv').config();

const temporaryClipsFolder = process.env.TEMPORARYCLIPSFOLDER
const NSFWValue = (process.env.ALLOWNSFW === 'true')
const maxClipDuration = process.env.MAXCLIPDURATION
const maxVideoDuration = process.env.MAXVIDEODURATION
const redditUrl = process.env.REDDITURL

/*
Pesquisa pelos Top Posts de um determinado tempo (na ultima hora, dia, semana, mês, ano ou de sempre) do subreddit passado por parâmetro e adiciona-os á lista de posts potênciais para
o video, verificando se:
 - São NSFW (Not Safe For Work, contendo nudez ou imagens demasiado gráficas)
 - Se os clipes têm a duração indicada no .env em segundos
 - Se a duração total dos posts obtidos não ultrapassa o tempo máximo indicado no .env
Dos posts encontrados são extraídos o título, o autor do video, o url do post e os url's do próprio video e aúdio
*/
async function getData(subReddit, timeFrame) {
    let postList = []
    let duration = 0
    let data = await fetch(redditUrl + subReddit + "/top.json?t="+timeFrame).then(response => response.json())
    for (let post of data.data.children) {
        if (post.data.post_hint == "hosted:video" && post.data.over_18 == NSFWValue && duration < maxVideoDuration && post.data.secure_media.reddit_video.duration < maxClipDuration) {
            let videoPost = {}
            videoPost.title = post.data.title
            videoPost.user = post.data.author
            videoPost.url = redditUrl + post.data.permalink
            if (post.data.secure_media != undefined) {
                videoPost.video = (post.data.secure_media.reddit_video.fallback_url).split('?')[0]
                videoPost.videoName = videoPost.video.split("/")[3] + ".mp4"
                videoPost.audio = (post.data.secure_media.reddit_video.fallback_url).split('_')[0] + '_audio.mp4'
                videoPost.audioName = videoPost.video.split("/")[3] + ".mp3"
                videoPost.duration = post.data.secure_media.reddit_video.duration
                duration += videoPost.duration
            }
            postList.push(videoPost)
        }
    }
    return postList
}

async function getOutro(subReddit){
    let outro = {}
    let data = await fetch(redditUrl + subReddit + "/.json").then(response => response.json())
    for (let post of data.data.children) {
            outro.title = post.data.title
            outro.user = post.data.author
            outro.url = redditUrl + post.data.permalink
            if (post.data.secure_media != undefined) {
                outro.video = (post.data.secure_media.reddit_video.fallback_url).split('?')[0]
                outro.videoName = outro.video.split("/")[3] + ".mp4"
                outro.audio = (post.data.secure_media.reddit_video.fallback_url).split('_')[0] + '_audio.mp4'
                outro.audioName = outro.video.split("/")[3] + ".mp3"
                outro.duration = post.data.secure_media.reddit_video.duration
            }  
    }
    console.log(outro)
    return outro
}

async function downloadOutro(url){
    return new Promise(async function(resolve){
        const pasta = "videosWithText"
        const fileStream = fs.createWriteStream(temporaryClipsFolder + pasta + "/outro.mp4")
        console.log("> [content-downloader] Downloading the outro")
        await getDataAsync(url, fileStream).then(await closeFileStreamAsync(fileStream)).then(resolve())
    })
}

// Faz o download de todos os ficheiros presentes na lista passada por parâmetro
async function downloadAllFiles (postList) {
    for (var post of postList) {
        await download(post.video, ".mp4")
        await download(post.audio, ".mp3")

    }
}

// Faz download de um ficheiro com base no seu URL e na sua extensão (podendo ser mp4 ou mp3)
async function download(url, ext) {

    return new Promise(async function (resolve) {
        const nomeVideo = (ext == ".gif") ? url.split("/")[3] : url.split("/")[3] + ext
        const pasta = (ext == ".mp4") ? "videos" : (ext == ".mp3") ? "audios" : null
        const fileStream = fs.createWriteStream(temporaryClipsFolder + pasta + "/" + nomeVideo);
        console.log("> [content-downloader] Downloading " + url + " into the folder " + pasta)
        await getDataAsync(url, fileStream).then(await closeFileStreamAsync(fileStream)).then(resolve())
    })
}



// Faz o download do ficheiro com recurso ao fileStream e usando o URL do video
async function getDataAsync(url, fileStream) {
    return new Promise(async function (resolve, reject) {
        https.get(url, async function (res) {
            console.log("> [content-downloader] Downloaded " + url + " successfully")
            res.pipe(fileStream);
            resolve()
        })
    })
}

// Fecha o pipe do fileStream
async function closeFileStreamAsync(fileStream) {
    return new Promise(async function (resolve) {
        fileStream.on("finish", async function (err) {
            fileStream.close()
            console.log("> [content-downloader] Closing fileStream")
            resolve()
        });
    });
}


module.exports = {
    getData: getData,
    downloadAllFiles: downloadAllFiles,
    getOutro: getOutro,
    download: download
}