var exec = require('child_process').exec
var fs = require('fs')

const envFound = require('dotenv').config();

const videosWithAudioFolder = process.env.VIDEOSWITHAUDIOFOLDER
const videosWithTextFolder = process.env.VIDEOSWITHTEXTFOLDER
const videosWithTextFolderForList = process.env.VIDEOSWITHTEXTFORLISTFOLDER
const preOutroFolder = process.env.PREOUTROFOLDER
const rightResolutionFolder = process.env.RIGHTRESOLUTIONFOLDER
const videosFolder = process.env.VIDEOSFOLDER
const audiosFolder = process.env.AUDIOSFOLDER
const temporaryResolutionFolder = process.env.TEMPORARYRESOLUTIONFOLDER

const videosFolderCmd = process.env.VIDEOSFOLDERCMD
const videosWithAudioFolderCmd = process.env.VIDEOSWITHAUDIOFOLDERCMD
const rightResolutionFolderCMD = process.env.RIGHTRESOLUTIONFOLDERCMD
const videosWithTextFolderCmd = process.env.VIDEOSWITHTEXTFOLDERCMD
const preOutroFolderCMD = process.env.PREOUTROFOLDERCMD
const fontFolder = process.env.FONTFOLDER

const listaDeVideos = process.env.LISTADEVIDEOS
const finalVideoFolder = process.env.FINALVIDEOFOLDER


//  Junta a componente do video de um post (.mp4) á respetiva componente de aúdio (.mp3)
async function joinVideoAndAudio(post, withAudioName) {
    return new Promise(async function (resolve) {
        try {
            exec('ffmpeg -i ' + videosFolder + post.videoName + ' -i ' + audiosFolder + post.audioName + ' -c copy ' + videosWithAudioFolder + withAudioName, (err, stdout, stderr) => {
                if (err) {
                    console.log("> [video-maker] Error joining audio and video for " + post.videoName)
                    resolve()
                    return true;
                } else {
                    console.log("> [video-maker] Joined video and audio for " + post.videoName)
                    resolve()
                    return false
                }
            })
        } catch (err) {
            console.log("> [video-maker] Erro: \n" + err)
        }
    })
}

//  Verifica a resolução de um clipe de video
async function checkResolution(videoName) {
    return new Promise((resolve) => {
        var resolution = ''
        exec('ffprobe -v error -select_streams v:0 -show_entries stream=display_aspect_ratio -of json=c=1 ' + videosWithAudioFolder + videoName, async function (err, stdout, stderr) {
            try {
                if (err) {
                    console.log("> [video-maker] Error verifying the resolution for " + videoName + "." + "\n> Output of the Error:\n" + err)
                    resolve()
                    return;
                } else {
                    console.log("> [video-maker] Checking Resolution for " + videoName)
                    resolution = JSON.parse(stdout).streams[0].display_aspect_ratio
                    console.log("> [video-maker] Resolution is: " + resolution)
                    if (resolution != "16:9") {
                        console.log("> [video-maker] Fixing resolution: " + resolution)
                        await fixResolution(videoName)
                        resolve()
                    } else {
                        console.log("> [video-maker] " + videoName + " has the right resolution. Moving it to the folder " + rightResolutionFolder)
                        exec('move ' + videosWithAudioFolderCmd + videoName + " " + rightResolutionFolderCMD, (err) => {
                            if (err) {
                                console.log("> [video-maker] Error moving the video " + post.videoName + "\n> Output of the Error:\n" + err)
                                resolve()
                            }
                            resolve()
                        })
                    }
                }
            } catch (err) {
                console.log("> [video-maker] Something went wrong" + err)
            }
        });

    })

}

//  Corrige a resolução de um vídeo que não tenha resolução 16:9, adicionando margens "blurred"
async function fixResolution(videoName) {
    return new Promise((resolve) => {
        try {
            exec('ffmpeg -i ' + videosWithAudioFolder + videoName + ' -lavfi "[0:v]scale=1920*2:1080*2,boxblur=luma_radius=min(h\\,w)/20:luma_power=1:chroma_radius=min(cw\\,ch)/20:chroma_power=1[bg];[0:v]scale=-1:1080[ov];[bg][ov]overlay=(W-w)/2:(H-h)/2,crop=w=1920:h=1080" '+ temporaryResolutionFolder + videoName + ' && ffmpeg -i '+ temporaryResolutionFolder + videoName + ' -vf "scale=1920:1080,setsar=1" ' + rightResolutionFolder + videoName, (err, stdout, stderr) => {
                if (err) {
                    console.log("> [video-maker] Error fixing the resolution of " + videoName + "\n> Output of the Error:\n" + err)
                    resolve()
                    return;
                } else {
                    console.log("> [video-maker] Resolution of " + videoName + " corrected")
                    resolve()

                }
            });

        } catch (err) {
            console.log("> [video-maker] Error moving the file " + videoName + " to the correct folder" + "\n> Output of the Error:\n" + err)
        }
    })

}

//  Adiciona o título do post original ao clipe do mesmo, sendo colocado no canto inferior esquerdo
async function addTextToVideo(post, video) {
    return new Promise((resolve) => {
        var title = post.title.replaceAll('\'','').replaceAll(':',' ');
        try {
            console.log("> [video-maker] Adding text to the video " + post.video)
            exec('ffmpeg -i ' + rightResolutionFolder + video + ' -vf "drawtext=fontfile=\'C\\:/' + fontFolder +'\':text=\'' + title + '\':x=0:y=h-th:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5:boxborderw=5:enable=\'between(t,' + 0 + ',' + post.duration + ')\'" -c:a copy ' + videosWithTextFolder + post.videoName.split('.')[0] + 'withText.mp4', (err, stdout, stderr) => {
                if (err) {
                    console.log("> [video-maker] Error adding text to the video " + post.videoName + "."
                        + "\n> Output of the Error:\n" + err)
                    resolve()
                    return;
                } else {
                    console.log("> [video-maker] Text added to the video " + post.videoName + ".")
                    resolve()
                }
            })

        } catch (err) {
        }
    })
}

//  Guarda num ficheiro .txt a localização e nomes dos ficheiros dos clipes a serem utilizados para o vídeo final
async function makeListFile(path) {
    var data = '';
    await new Promise((resolve) => {
        try {
            console.log("> [video-maker] Creating file list.")
            fs.readdir(path, (err, files) => {
                files.forEach(file => {
                    data += 'file ' + path.split("../")[1] + file + "\n";
                })
                fs.writeFile(listaDeVideos, data, function (err) {
                    if (err) return console.log(err);
                })
                console.log("> [video-maker] File list created.")
                resolve()
            })
        } catch (err) {
            console.log("> [video-maker] Error creating the file list.\nOutput of the Error:\n" + err)
        }
    })
    return data
}

/*
    Junta todos os clipes já editados (com as resoluções certas, com aúdio e video sincronizados e texto no ecrã) e
    cria o video final a ser publicado no youtube
*/
async function videoMaker(videoName) {
    return new Promise((resolve, reject) => {
        exec('ffmpeg -safe 0 -f concat -i ../listaDeVideos.txt -c copy ' + finalVideoFolder + videoName, async function (err) {
            if (err) {
                console.log("> [video-maker] Error creating final video "
                    + ".\n> Output of the Error:\n" + err)
                reject()
                return;
            } else {
                console.log("> [video-maker] Final video created with the name: " + videoName)
                resolve()
            }
        });
    })
}
async function convertVideo(videoToConvert, videoConverted) {
    return new Promise((resolve, reject) => {
        console.log("> [video-maker] Changing video format")
        exec('ffmpeg -i '+ videoToConvert+' '+ videoConverted, async function (err) {
            if (err) {
                console.log("> [video-maker] Error changing format of the video "
                    + ".\n> Output of the Error:\n" + err)
                reject()
                return;
            } else {
                console.log("> [video-maker] Video format changed")
                resolve()
            }
        });
    })
}

async function moveOutro(outroName){
    return new Promise((resolve, reject) => {
        exec('move ' + videosWithAudioFolderCmd + outroName + " " + videosWithTextFolderCmd, (err) => {
            if (err) {
                console.log("> [video-maker] Error moving the video " + outroName + "\n> Output of the Error:\n" + err)
                resolve()
            }
            resolve()
        })
    })
}



module.exports = {
    joinVideoAndAudio: joinVideoAndAudio,
    checkResolution: checkResolution,
    addTextToVideo: addTextToVideo,
    makeListFile: makeListFile,
    videoMaker: videoMaker,
    moveOutro: moveOutro,
    convertVideo: convertVideo
}