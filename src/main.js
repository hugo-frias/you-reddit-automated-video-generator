
const envFound = require('dotenv').config();
var downloader = require('./contentDownloader.js')
var videoMaker = require('./videoMaker.js')
var videoUploader = require('./videoUploader.js')
var readline = require('readline')
var exec = require('child_process').exec
const { exit } = require('process')


const videosWithTextFolder = process.env.VIDEOSWITHTEXTFOLDER
const finalVideosFolder = process.env.FINALVIDEOFOLDER
const preOutroFolder = process.env.PREOUTROFOLDER

const preOutroFolderCmd = process.env.PREOUTROFOLDERCMD

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

// Método de começo do script
async function start() {

    // Lista vazia que irá conter os posts a serem utilizados
    let postList = [];

    // Cria uma nova instância de data que irá ser posteriormente utilizada na nomenclatura de ficheiros
    let date = new Date()

    const subReddit = await new Promise((resolve) => {
        rl.question("Choose the subReddit [r/subRedditName]\n", ans => {
            resolve(ans)
        })
    })

    let timeframe = await new Promise((resolve, reject) => {
        rl.question("Choose the timeframe of the top posts [hour, day, week, month, year, all]\n", ans => {
            if (ans != "hour" && ans != "day" && ans !== "week" && ans != "month" && ans != "year" && ans != "all") {
                console.log("Invalid timeframe")
                rl.close()
                reject()
                exit()
            } else{
                rl.close()
                resolve(ans)
            }
        })
    })

    console.log("Top Posts of the " + timeframe + " in the subreddit " + subReddit + ":")

    // Recolhe os top posts de um subReddit, colocando-os na postList e ordenando-os pelo seu id
    postList = await downloader.getData(subReddit, timeframe)
    postList.sort(function (a, b) {
        if (a.videoName < b.videoName) { return -1; }
        if (a.videoName > b.videoName) { return 1; }
        return 0;
    })

    console.log(postList)

    // Faz o download do conteúdo dos posts recolhidos anteriormente
    if (postList.length < 30) {
        console.log("Starting the Downloads")
        await downloader.downloadAllFiles(postList)
        console.log("All files Downloaded")
    }

    //  Junta as componentes de video (.mp4) ás respetivas componentes de aúdio (.mp3) de todos os posts da postList
    for (var post of postList) {
        var withAudioName = post.videoName.split('.')[0] + 'withAudio.mp4'
        await videoMaker.joinVideoAndAudio(post, withAudioName)
    }

    //  Verifica as resoluções dos clipes de video presentes nos posts da postList, corrigindo-os caso não sejam 16:9
    for (var post of postList) {
        var withAudioName = post.videoName.split('.')[0] + 'withAudio.mp4'
        await videoMaker.checkResolution(withAudioName)
    }

    // Adiciona o título do post ao seu clipe de video
    for (var post of postList) {
        var withAudioName = post.videoName.split('.')[0] + 'withAudio.mp4'
        await videoMaker.addTextToVideo(post, withAudioName)
    }


    // Guarda num ficheiro .txt a localização e nomes dos ficheiros dos clipes a serem utilizados para o vídeo final
    let fileList = await videoMaker.makeListFile(videosWithTextFolder)

    let finalVideoName = 'final_' + date.getDate() + date.getMonth() + date.getFullYear() + '_' + subReddit.split('/')[1] + '.mp4'
    /*
    Junta todos os clipes já editados (com as resoluções certas, com aúdio e video sincronizados e texto no ecrã) e
    cria o video final a ser publicado no youtube
    */
    await videoMaker.videoMaker(finalVideoName)

    // Requesita as autorizações ao utilizador e faz o upload do vídeo para o youtube
    await videoUploader.uploadYoutube(finalVideoName, postList, fileList, subReddit)

    // Pergunta ao utilizador se deseja limpar os ficheiros gerados ao longo do script (excepto o video final)
    await cleanFolders()

}

// Limpa o conteúdo das pastas utilizadas
async function cleanFolders() {

    const rl3 = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    

    const answer = await new Promise((resolve) => {
        rl3.resume()
        rl3.question("Do you want to delete all videos downloaded? (Y/N)\n", ans => {
            rl3.close()
            resolve(ans)
        })
    })
    if (answer.localeCompare('y', undefined, { sensitivity: 'accent' }) == 0) {
        await deleteFiles()
    } else {
        console.log("The videos were not deleted.")
    }

}

// Apaga os ficheiros transferidos anteriormente e limpa a lista de ficheiros gerada
async function deleteFiles() {
    return new Promise((resolve, reject) => {
        exec('del /s /q ..\\media\\temporaryClips\\audios\\ && del /s /q ..\\media\\temporaryClips\\videos\\ && del /s /q ..\\media\\temporaryClips\\videoAndAudio\\ && del /s /q ..\\media\\temporaryClips\\videosWithText\\  && del /s /q ..\\media\\temporaryClips\\tempResolution\\ && del /s /q ..\\media\\temporaryClips\\16by9videos\\ && break>..\\..\\listaDeVideos.txt', async function (err, stdout, stderr) {
            if (err) {
                console.log(err)
                reject()
                return;
            }            
            // sdout e stderr buffered
            console.log('stdout: ' + stdout);
            resolve()
        });
    })
}

async function deleteFile(file){
    return new Promise((resolve, reject) => {
        exec('del '+file, async function (err, stdout, stderr) {
            if (err) {
                console.log(err)
                reject()
                return;
            }            
            // sdout e stderr buffered
            console.log('Ficheiro temporário apagado');
            resolve()
        });
    })
}

start()