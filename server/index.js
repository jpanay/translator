const express = require('express');
const bodyParser = require('body-parser')
const path = require('path')
const cors = require('cors');
const fs = require('fs');
const util = require('util');
const keys = require('./googleKeys/keys')
const { Translate } = require('@google-cloud/translate').v2;
const speech = require('@google-cloud/speech');
const textToSpeech = require('@google-cloud/text-to-speech');
const ffmpeg = require('ffmpeg')
const request = require('request');
const http = require('http');
const fetch = require('node-fetch');
const Busboy = require('busboy')


console.log(__dirname)
const app = express()
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, '../public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '../public/index.html'));
})

// Remove Audio Files on load
app.post('/remove-files', (req, res) => {
  console.log('Removing Audio Files ...')
  let serverAudio = '/Users/jasonpanay/Desktop/MVP/server/audioFiles'
  console.log('loading')
  fs.readdir(serverAudio, (err, files) => {
    if (err) throw err;
    for (let file of files) {
      console.log(`Removing ${file}`)
      fs.unlink(path.join(serverAudio, file), err => {
        if (err) throw err;
      });
    }
  });
  let publicAudio = '/Users/jasonpanay/Desktop/MVP/public/audioFiles/'
  fs.readdir(publicAudio, (err, files) => {
    if (err) throw err;
    for (let file of files) {
      console.log(`Removing ${file}`)
      fs.unlink(path.join(publicAudio, file), err => {
        if (err) throw err;
      });
    }
  });
  res.send('~ Audio Files Removed')
})

// ------ API Setup -------
// Translate
app.post('/translate', (req, res) => {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/Users/jasonpanay/Desktop/MVP/server/googleKeys/NativeTranslator-d1745d1b31d2.json'
  const projectId = {
    projectId: 'nativetranslator',
    credentials: keys.GOOGLE_APPLICATION_CREDENTIALS
  }
  // Translate Text
  const translate = new Translate({projectId});

  const resData = req.body
  const text = req.body.string
  const lang1 = req.body.state.lang1
  const lang2 = req.body.state.lang2

  async function quickTranslate() {
    console.log('Running Translate ...')
    const target = lang2;
    const [translation] = await translate.translate(text, target);
    console.log('~ Translate Complete')
    res.send(translation)
  }
  quickTranslate()
})

// Speech To Text
app.post('/speech-to-txt', (req, res) => {
  console.log('Running Speech To Text ...')
  let currFileName = req.body.filename
  let currLangcode = req.body.langcode
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/Users/jasonpanay/Desktop/MVP/server/googleKeys/NativeTranslator-daae3f8dea7a.json'
  const client = new speech.SpeechClient();
  // Creates a client
  async function speechToText() {
   const filename = `server/audioFiles/${currFileName}.mp3`;
   const encoding = 'mpeg-3';
   const sampleRateHertz = 16000;
   const languageCode = 'en-US'; // set to req.currLangCode

   const config = {
     encoding: encoding,
     sampleRateHertz: sampleRateHertz,
     languageCode: languageCode
   };
   const audio = {
     content: fs.readFileSync(filename).toString('base64')
    // content: req.body.data
   };

   const request = { config: config, audio: audio };
   // Detects speech in the audio file
   const [response] = await client.recognize(request);
   const transcription = response.results
     .map(result => result.alternatives[0].transcript)
     .join('\n');
   console.log('~ Speech To Text Complete')
   res.send(transcription)
  }
  speechToText();
})

// Text to Speech
app.post('/txt-to-speech', (req, res) => {
  let currFileName = req.body.filename
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '/Users/jasonpanay/Desktop/MVP/server/googleKeys/NativeTranslator-05f475f3f977.json'
  const client = new textToSpeech.TextToSpeechClient();
  async function txtToSpeech() {
    console.log('Running Text To Speech ...')
    // The text to synthesize
    const text = req.body.text;
    // Construct the request
    const request = {
      input: {text: text},
      // Select the language and SSML voice gender (optional)
      voice: {languageCode: 'es-ES', ssmlGender: 'MALE'},
      // select the type of audio encoding
      audioConfig: {audioEncoding: 'MP3'},
    };

    // Performs the text-to-speech request
    const [response] = await client.synthesizeSpeech(request);
    // Write the binary audio content to a local file
    const writeFile = util.promisify(fs.writeFile);
    let audioPath = `public/audioFiles/${currFileName}.mp3`
    await writeFile(audioPath, response.audioContent, 'binary');
    console.log(`~ Text To Speech Complete (${audioPath})`);
    console.log('----- Complete -----')
    res.set('Cache-Control', 'public, max-age=2');
    res.send(`~ Text To Speech Complete (${audioPath})`)
  }
  txtToSpeech();
})

// Blob to mp3
app.post('/blob-to-mp3', (req, res) => {
  console.log('Running Blob To MP3 ...')
  let currFileName = req.body.filename
  let blobPath = `/Users/jasonpanay/Desktop/MVP/server/audioFiles/${currFileName}`

  try {
    var process = new ffmpeg(blobPath);
    process.then(function (audio) {
      // Callback mode
      console.log('~ FFMPEG Proccessing')
      audio.fnExtractSoundToMP3(`/Users/jasonpanay/Desktop/MVP/server/audioFiles/${currFileName}.mp3`, function (error, file) {
        if (!error) {
          console.log('~ FFMPEG Success: ' + file);
          res.send('DONE')
        }
        if (error) { console.log('FFMPEG ERR ' + error); }
      });
    }, function (err) {
      console.log('Error: ' + err);
    });
  } catch (e) {
    console.log(e.code);
    console.log(e.msg);
    res.send('ERROR')
  }
});

// Upload Blob File
app.post('/upload-blob', (req, res) => {
  let audioName
  let busboy = new Busboy({ headers: req.headers });
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
      audioName = filename
      let saveTo = `./server/audioFiles/${filename}`
      console.log('Uploading Blob: ' + saveTo);
      file.pipe(fs.createWriteStream(saveTo));
    });
    busboy.on('finish', function() {
      console.log('~ Upload complete');
      res.writeHead(200, { 'Connection': 'close' });
      res.end(audioName);
    });
    return req.pipe(busboy);
})


// Run server
const PORT =  3020;
app.listen(PORT, () =>  {
  console.log(`Listening on PORT: ${PORT}`)
});
