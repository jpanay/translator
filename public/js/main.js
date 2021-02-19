//
const state = {
  lang1: 'en', // Native Language
  lang2: 'es', // Foreign Language
  translating: false, // false = idle, true = translating
  voice: 'M', // M for male, F for female
  currFileName: ''
}

// Set languages
let setLang = () => {
  state.lang1 = document.querySelector('#lang1').value
  state.lang2 = document.querySelector('#lang2').value
  state.voice = document.querySelector('#voice').value
  // console.log(state)
}

// Remove Audio Files on Load
let removeAudio = () => {
  console.log('Removing Files')
  axios.post('http://localhoost:3020/remove-files', {})
    .then((res) => { return console.log(res) })
}
// removeAudio()

let saveConvo = () => {
  let saveDiv = document.querySelector('.save-convo-div')
  saveDiv.style.opacity = '1'
  setTimeout(() => {
    saveDiv.style.opacity = '0'
  }, 1000)
}
$('.save-convo-btn').click(() => {
  console.log('Saving Convo ...')
  saveConvo()
})

let renderDiv = (type, text) => {
  if (!text) { return console.log('!! Text Not Found') }
  let itemDiv = document.querySelector('.text-box')
  let textItem = document.createElement('div')
  textItem.classList.add("text-item");
  let textUser = document.createElement('div')
  textUser.classList.add("text-user");
  textUser.innerHTML = type
  let textContent = document.createElement('div')
  textContent.classList.add("text-content");
  textContent.innerHTML = text

  textItem.appendChild(textUser)
  textItem.appendChild(textContent)
  itemDiv.prepend(textItem)
}

// Translate
let translate = (inputString, cb) => {
  console.log('Running Translate ...')
  let translationSettings = {
    name: 'Data',
    string: inputString,
    state: state
  }
  $.post('http://localhost:3020/translate', translationSettings)
    .then((res) => {
      console.log('~ Translate Complete')
      $('#translated').html(res)
      cb(res);
    })
}

// Convert Audio
let convertAudio = () => {
  console.log('Running Speech To Text ...')
  let fileData = { name: 'MP3 Data', filename: state.currFileName, langcode: '' }
  $.post('http://localhost:3020/speech-to-txt', fileData)
    .then((nativeText) => {
      renderDiv('Native', nativeText)
      console.log('~ Speech To Text Complete')
      translate(nativeText, (foreignText) => {
        renderDiv('Foreign', foreignText)
        let speechData = { name: 'Foreign Text', text: foreignText, filename: state.currFileName }
        console.log('Running Text To Speech ...')
        $.post('http://localhost:3020/txt-to-speech', speechData)
          .then((fileName) => {
            console.log('~ Text To Speech Complete')
            console.log('Playing New Audio ...')
            let audioPlayer = new Audio(`audioFiles/${state.currFileName}.mp3`);
            audioPlayer.play()
            console.log(audioPlayer)
            console.log('----- Complete -----')
          })
      })
  })
}

// Capture Audio
let captureAudio = (cb = () => {}) => {
  // console.log(navigator.mediaDevices)
  navigator.mediaDevices.enumerateDevices()
    .then((devices) => {
      // console.log(devices)
    })

  navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then((stream) => {
      console.log('Recording Started ...')
      let mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
      });

      let audioChunks = [];
      mediaRecorder.start();
      mediaRecorder.addEventListener("stop", () => {
        console.log('Saving Recording ...')
        let audioBlob = new Blob(audioChunks, {type: 'audio/mpeg-3'})
        audioChunks = [];
        let audioUrl = URL.createObjectURL(audioBlob);
        let audio = new Audio(audioUrl);
        let audioFile = new File([audioBlob], "blob.mp3", { type: "audio/mpeg-3" })

        // console.log(audioUrl)
        // console.log(audioBlob)
        let audioName = audioUrl.split('/')[3];
        state.currFileName = audioName;
        let formData = new FormData();
        formData.append("photo", audioFile, audioName);

        fetch('/upload-blob', {method: "POST", body: formData})
          .then((res) => {
            let fileData = { name: 'MP3 Data', filename: audioName }
            console.log(fileData)
            console.log('Running Blob to Mp3 ...')
            axios.post('/blob-to-mp3', fileData)
              .then((res) => {
                cb()
                return console.log('~ Audio Capture Complete')
              })
          })
          .catch((err) => { console.log(err) })
      })

      let stopCheck = setInterval(() => {
        if (!state.translating) {
          console.log('Stopping Recording ...')
          mediaRecorder.stop();
          clearInterval(stopCheck)
        }
      }, 100);
    })
    .catch((err) => { return console.log(err) })
}


let translateBtn = document.querySelector('#translate-btn-img')
$('#translate-btn').on('click', () => {
  if (state.translating === false) {
    console.log('Capturing Audio ...')
    captureAudio(() => {
      convertAudio()
    })
    state.translating = true
    translateBtn.src = 'media/stop.svg'
  } else if (state.translating){
    console.log('Converting and Idling ...')
    // convertAudio()
    state.translating = false
    translateBtn.src = 'media/mic.svg'
  }
})


let fileToTxt = () => {
  console.log('Running File To Text ...')
  let audioInput = document.getElementById('audio-file').files[0];

  let formData = new FormData();
  formData.append("photo", audioInput);

  fetch('/blob-to-mp3', {method: "POST", body: formData});
}







